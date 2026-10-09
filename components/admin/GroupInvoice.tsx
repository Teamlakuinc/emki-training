'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminCreateGroupInvoice, adminDeleteGroupInvoice } from '@/app/admin/actions';
import { rupiah, tanggal, waktu } from '@/lib/format';
import { waNumber } from '@/lib/templates';
import RecordPayment from '@/components/admin/RecordPayment';

const inp = { font: 'inherit', fontSize: 14, padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8, width: '100%' } as const;

export default function GroupInvoice({ apps, invoices }: { apps: any[]; invoices: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(''); const [coord, setCoord] = useState(''); const [sched, setSched] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [f, setF] = useState({ title: '', payer_name: '', payer_phone: '', payer_email: '' });
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [made, setMade] = useState<{ url: string; code: string } | null>(null);

  const coords = Array.from(new Map(apps.filter(a => a.coordinators).map(a => [a.coordinators.code, a.coordinators.name])).entries());
  const scheds = Array.from(new Map(apps.filter(a => a.exam_sessions?.exam_schedules).map(a => [a.exam_sessions.exam_schedules.id, a.exam_sessions.exam_schedules])).values());
  const shown = useMemo(() => apps.filter(a =>
    (!q || `${a.full_name} ${a.reg_code}`.toLowerCase().includes(q.toLowerCase())) &&
    (!coord || a.coordinators?.code === coord) && (!sched || a.exam_sessions?.exam_schedules?.id === sched)), [apps, q, coord, sched]);
  const total = apps.filter(a => sel.includes(a.id)).reduce((s, a) => s + Number(a.amount || 0), 0);
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  const allShown = shown.length > 0 && shown.every(a => sel.includes(a.id));

  const waText = (url: string, code: string, n: number, tot: number) => `Halo ${f.payer_name || ''} 🙏\n\nBerikut link pembayaran kolektif sertifikasi BNSP untuk *${n} peserta* (${code}).\nTotal: *${rupiah(tot)}*\n\n${url}\n\nCukup buka link dan bayar sekali (VA bank, QRIS, e-wallet), tanpa login. Setelah lunas, semua peserta otomatis terkonfirmasi. Terima kasih 🙏`;

  return (<>
    {msg && <div className={`alert alert-${msg.t}`}>{msg.m}</div>}
    {made && <div className="alert alert-ok">
      ✅ Tagihan <b>{made.code}</b> dibuat. <input readOnly value={made.url} onFocus={e => e.target.select()} style={{ ...inp, margin: '8px 0' }} />
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(made.url)}>📋 Salin link</button>
        {f.payer_phone && <a className="btn btn-wa btn-sm" target="_blank" rel="noopener" href={`https://wa.me/${waNumber(f.payer_phone)}?text=${encodeURIComponent(waText(made.url, made.code, sel.length, total))}`}>💬 Kirim ke pembayar</a>}
        <button className="btn btn-outline btn-sm" onClick={() => { setMade(null); setSel([]); setF({ title: '', payer_name: '', payer_phone: '', payer_email: '' }); }}>Buat tagihan lain</button>
      </div></div>}

    <div className="card">
      <h2>1. Pilih peserta ({sel.length} dipilih · {rupiah(total)})</h2>
      <div className="grid2" style={{ marginBottom: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama / no. registrasi" style={inp} />
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <select value={coord} onChange={e => setCoord(e.target.value)} style={inp}><option value="">Semua koordinator</option>{coords.map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}</select>
          <select value={sched} onChange={e => setSched(e.target.value)} style={inp}><option value="">Semua jadwal</option>{scheds.map((s: any) => <option key={s.id} value={s.id}>{tanggal(s.exam_date)} · {s.title}</option>)}</select>
        </div>
      </div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th><input type="checkbox" checked={allShown} onChange={() => setSel(allShown ? sel.filter(id => !shown.some(a => a.id === id)) : Array.from(new Set([...sel, ...shown.map(a => a.id)])))} /></th>
          <th>Peserta</th><th>Skema</th><th>Ujikom</th><th>Koordinator</th><th>Batas bayar</th><th style={{ textAlign: 'right' }}>Biaya</th></tr></thead>
        <tbody>{shown.map(a => <tr key={a.id} onClick={() => toggle(a.id)} style={{ cursor: 'pointer', background: sel.includes(a.id) ? 'var(--blue-soft)' : undefined }}>
          <td><input type="checkbox" checked={sel.includes(a.id)} onChange={() => toggle(a.id)} onClick={e => e.stopPropagation()} /></td>
          <td>{a.full_name}<div className="muted small">{a.reg_code}</div></td><td className="small">{a.schemes?.name}</td>
          <td className="small">{a.exam_sessions?.exam_schedules ? tanggal(a.exam_sessions.exam_schedules.exam_date) : '-'}</td>
          <td className="small">{a.coordinators?.code || '—'}</td><td className="small">{a.payment_due_at ? waktu(a.payment_due_at) : '-'}</td>
          <td style={{ textAlign: 'right' }}>{rupiah(a.amount)}</td></tr>)}
          {!shown.length && <tr><td colSpan={7} className="muted">Tidak ada peserta yang menunggu pembayaran.</td></tr>}</tbody>
      </table></div>
    </div>

    <div className="card">
      <h2>2. Data pembayar (opsional)</h2>
      <div className="grid2">
        <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Judul tagihan, mis. Karyawan Hotel X – Ujikom 31 Okt" style={inp} />
        <input value={f.payer_name} onChange={e => setF({ ...f, payer_name: e.target.value })} placeholder="Nama pembayar / perusahaan" style={inp} />
        <input value={f.payer_phone} onChange={e => setF({ ...f, payer_phone: e.target.value })} placeholder="No. WA pembayar" inputMode="tel" style={inp} />
        <input value={f.payer_email} onChange={e => setF({ ...f, payer_email: e.target.value })} placeholder="Email pembayar (untuk bukti dari DOKU)" type="email" style={inp} />
      </div>
      <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={pending || !sel.length} onClick={() => start(async () => {
        setMsg(null); const r = await adminCreateGroupInvoice(sel, f);
        if (!r.ok) return setMsg({ t: 'err', m: r.error! }); setMade(r.data); router.refresh(); window.scrollTo({ top: 0, behavior: 'smooth' });
      })}>{pending ? 'Membuat…' : `Buat link tagihan (${sel.length} peserta · ${rupiah(total)})`}</button>
    </div>

    <div className="card">
      <h2>Tagihan kolektif yang sudah dibuat</h2>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Kode</th><th>Judul / pembayar</th><th>Peserta</th><th style={{ textAlign: 'right' }}>Total</th><th>Dibuat</th><th></th></tr></thead>
        <tbody>{invoices.map(g => <tr key={g.id}>
          <td><b>{g.code}</b></td><td className="small">{g.title || '—'}<div className="muted">{g.payer_name || ''}</div></td>
          <td>{g.paid === g.count ? <span className="badge green">Lunas {g.paid}/{g.count}</span> : <span className="badge amber">Lunas {g.paid}/{g.count}</span>}</td>
          <td style={{ textAlign: 'right' }}>{rupiah(g.total)}</td><td className="small">{waktu(g.created_at)}</td>
          <td><div className="row" style={{ gap: 6 }}>
            <a className="btn btn-outline btn-sm" href={g.url} target="_blank" rel="noopener">Buka</a>
            <button className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard.writeText(g.url); setMsg({ t: 'ok', m: `Link ${g.code} disalin.` }); }}>📋 Salin</button>
            {g.payer_phone && <a className="btn btn-wa btn-sm" target="_blank" rel="noopener" href={`https://wa.me/${waNumber(g.payer_phone)}?text=${encodeURIComponent(waText(g.url, g.code, g.count, g.total))}`}>💬 Kirim</a>}
            {!g.lunas && <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => { if (confirm(`Hapus tagihan ${g.code}?`)) start(async () => { const r = await adminDeleteGroupInvoice(g.id); setMsg(r.ok ? { t: 'ok', m: 'Tagihan dihapus.' } : { t: 'err', m: r.error! }); router.refresh(); }); }}>Hapus</button>}
          </div>
          {g.paid < g.count && <div style={{ marginTop: 6 }}><RecordPayment target={{ groupId: g.id }} amount={g.unpaid} label={`tagihan ${g.code}`} defaultName={g.payer_name || ''} compact /></div>}
          </td></tr>)}
          {!invoices.length && <tr><td colSpan={6} className="muted">Belum ada tagihan kolektif.</td></tr>}</tbody>
      </table></div>
    </div>
  </>);
}
