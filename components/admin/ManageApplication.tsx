'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS, rupiah, waktu } from '@/lib/format';
import { adminSetCoordinator, adminReprice, adminSetAmount, adminSetStatus, adminSetScheme, adminDeleteApplication, adminSetDeadline, adminSendReset, adminMoveToAccount } from '@/app/admin/actions';

const inp = { style: { font: 'inherit', fontSize: 14, padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8, width: '100%' } } as const;
const ACT: Record<string, string> = { ubah_koordinator: 'Ubah koordinator', hitung_ulang_harga: 'Hitung ulang harga', ubah_harga_manual: 'Ubah harga manual', ubah_status_manual: 'Ubah status', ubah_skema: 'Ubah skema', ubah_data_peserta: 'Ubah data peserta', hapus_pendaftaran: 'Hapus', upload_dokumen_admin: 'Upload dokumen oleh admin', kembali_ke_verifikasi: 'Kembalikan ke antrean verifikasi', siapkerja_salah: 'Tandai akun SIAPkerja salah', siapkerja_beres: 'Tandai SIAPkerja beres', batalkan_persetujuan: 'Batalkan persetujuan → perlu perbaikan', ubah_batas_bayar: 'Ubah batas bayar', kirim_reset_password: 'Kirim link reset password', pindah_akun: 'Pindahkan ke akun lain', pakai_versi_dokumen: 'Pakai versi dokumen lama' };

export default function ManageApplication({ a, coordinators, schemes, logs, isSuper, fields = [] }: { a: any; coordinators: any[]; schemes: any[]; logs: any[]; isSuper: boolean; fields?: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [coord, setCoord] = useState(a.coordinator_id || '');
  const [reprice, setReprice] = useState(a.status !== 'paid');
  const [amount, setAmount] = useState(a.amount != null ? String(a.amount) : '');
  const [amtReason, setAmtReason] = useState('');
  const [status, setStatus] = useState(a.status); const [stReason, setStReason] = useState('');
  const [scheme, setScheme] = useState(a.scheme_id); const [schRe, setSchRe] = useState(true);
  const toLocal = (iso?: string) => { const d = iso ? new Date(iso) : new Date(Date.now() + 72 * 3600e3); return new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16); };
  const [due, setDue] = useState(toLocal(a.payment_due_at));
  const [moveEmail, setMoveEmail] = useState('');
  const [del, setDel] = useState('');
  const run = (fn: () => Promise<any>, ok: string) => start(async () => { setMsg(null); const r = await fn(); if (!r.ok) return setMsg({ t: 'err', m: r.error }); setMsg({ t: 'ok', m: ok }); router.refresh(); });
  const sec = { borderTop: '1px dashed var(--line)', paddingTop: 14, marginTop: 14 } as const;
  return (
    <div className="card" style={{ borderColor: '#E6D3A8', background: '#FFFCF6' }}>
      <h2>Kelola peserta (Super Admin)</h2>
      <p className="muted small">Semua perubahan tercatat di riwayat di bawah.</p>
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}

      <div><span className="lbl">Koordinator</span>
        <select value={coord} onChange={e => setCoord(e.target.value)} {...inp}><option value="">— tanpa koordinator (daftar langsung) —</option>
          {coordinators.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</select>
        <label className="check small" style={{ margin: '8px 0' }}><input type="checkbox" checked={reprice} onChange={e => setReprice(e.target.checked)} />Hitung ulang harga sesuai koordinator {a.status === 'paid' && <span className="muted">(peserta sudah lunas — biasanya tidak perlu)</span>}</label>
        <button className="btn btn-primary btn-sm" disabled={pending || coord === (a.coordinator_id || '')} onClick={() => run(() => adminSetCoordinator(a.id, coord || null, reprice), 'Koordinator diperbarui. Akun peserta juga ditandai ke koordinator ini.')}>Simpan koordinator</button></div>

      <div style={sec}><span className="lbl">Harga</span>
        <div className="row"><button className="btn btn-outline btn-sm" disabled={pending || !a.session_id} onClick={() => run(() => adminReprice(a.id), 'Harga dihitung ulang dari skema + jadwal + koordinator.')}>↻ Hitung ulang otomatis</button>
          <span className="muted small">Saat ini: <b>{a.amount != null ? rupiah(a.amount) : 'belum dikunci'}</b></span></div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <input value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="Harga manual, mis. 2800000" inputMode="numeric" {...inp} />
          <input value={amtReason} onChange={e => setAmtReason(e.target.value)} placeholder="Alasan (wajib)" {...inp} /></div>
        <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} disabled={pending || !amount} onClick={() => run(() => adminSetAmount(a.id, Number(amount), amtReason), 'Harga diubah. Komisi koordinator ikut dihitung ulang.')}>Set harga manual {amount ? `(${rupiah(Number(amount))})` : ''}</button></div>

      <div style={sec}><span className="lbl">Status</span>
        <div className="grid2"><select value={status} onChange={e => setStatus(e.target.value)} {...inp}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <input value={stReason} onChange={e => setStReason(e.target.value)} placeholder="Alasan (wajib)" {...inp} /></div>
        <p className="muted small" style={{ margin: '6px 0' }}>Lunas → tanggal lunas diisi sekarang. Menunggu pembayaran → batas bayar 3×24 jam dari sekarang. Draft → peserta bisa mengedit lagi.</p>
        <button className="btn btn-outline btn-sm" disabled={pending || status === a.status} onClick={() => run(() => adminSetStatus(a.id, status, stReason), 'Status diubah.')}>Simpan status</button></div>

      <div style={sec}><span className="lbl">Skema</span>
        <select value={scheme} onChange={e => setScheme(e.target.value)} {...inp}>{schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <label className="check small" style={{ margin: '8px 0' }}><input type="checkbox" checked={schRe} onChange={e => setSchRe(e.target.checked)} />Hitung ulang harga untuk skema baru</label>
        <button className="btn btn-outline btn-sm" disabled={pending || scheme === a.scheme_id} onClick={() => run(() => adminSetScheme(a.id, scheme, schRe), 'Skema diubah.')}>Simpan skema</button></div>

      <div style={sec}><span className="lbl">Data peserta</span>
        <p className="small" style={{ margin: 0 }}>Edit data peserta, SIAPkerja &amp; password SIAPkerja lewat tombol <a href="#edit-data"><b>✎ Edit data peserta</b></a> di kartu Data peserta.</p></div>

      {['awaiting_payment', 'expired'].includes(a.status) && <div style={sec}><span className="lbl">Batas bayar</span>
        <div className="row"><input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} style={{ ...inp.style, width: 240 }} />
          <button className="btn btn-outline btn-sm" disabled={pending || !due} onClick={() => run(() => adminSetDeadline(a.id, new Date(due).toISOString()), 'Batas bayar diubah.')}>Simpan batas bayar</button></div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>Status Kedaluwarsa otomatis kembali ke Menunggu pembayaran.</p></div>}

      <div style={sec}><span className="lbl">Akun login peserta</span>
        <p className="small" style={{ margin: '0 0 6px' }}>Email login: <b>{a.account_email || '-'}</b></p>
        <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => start(async () => {
          if (!confirm('Kirim email link buat password baru ke peserta?')) return;
          const r = await adminSendReset(a.id); setMsg(r.ok ? { t: 'ok', m: `Link reset password dikirim ke ${r.data.email}.` } : { t: 'err', m: r.error! }); router.refresh();
        })}>🔑 Kirim link reset password</button>
        <div style={{ marginTop: 10 }}><span className="small"><b>Pindahkan pendaftaran ke akun lain</b> (mis. peserta terlanjur membuat akun baru)</span>
          <div className="row" style={{ marginTop: 6 }}><input type="email" value={moveEmail} onChange={e => setMoveEmail(e.target.value)} placeholder="email akun tujuan" style={{ ...inp.style, width: 260 }} />
            <button className="btn btn-outline btn-sm" disabled={pending || !moveEmail.trim()} onClick={() => { if (confirm(`Pindahkan pendaftaran ini ke akun ${moveEmail}?`)) run(() => adminMoveToAccount(a.id, moveEmail), 'Pendaftaran dipindahkan ke akun tujuan.'); }}>Pindahkan</button></div></div></div>

      {isSuper && <div style={sec}><span className="lbl" style={{ color: 'var(--red)' }}>Hapus pendaftaran</span>
        <p className="small" style={{ margin: '0 0 6px' }}>Menghapus permanen pendaftaran, dokumen, bukti transfer, dan catatan pembayarannya. Ketik <b>{a.reg_code || 'HAPUS'}</b> untuk konfirmasi.</p>
        <div className="row"><input value={del} onChange={e => setDel(e.target.value)} placeholder={a.reg_code || 'HAPUS'} style={{ ...inp.style, width: 220 }} />
          <button className="btn btn-danger btn-sm" disabled={pending || del.trim().toUpperCase() !== (a.reg_code || 'HAPUS').toUpperCase()} onClick={() => start(async () => {
            const r = await adminDeleteApplication(a.id, del); if (!r.ok) return setMsg({ t: 'err', m: r.error! }); router.push('/admin/pendaftar?dihapus=1'); })}>Hapus permanen</button></div></div>}

      {logs.length > 0 && <div style={sec}><span className="lbl">Riwayat perubahan</span>
        {logs.map((l: any) => <p key={l.id} className="small" style={{ margin: '0 0 6px' }}><b>{ACT[l.action] || l.action}</b> · {waktu(l.created_at)} · {l.profiles?.full_name || l.profiles?.email}<br />
          <span className="muted">{Object.entries(l.detail || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v ?? '-'}`).join(' · ')}</span></p>)}</div>}
    </div>
  );
}
