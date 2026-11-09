'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { statusOf, rupiah, tanggal, jam } from '@/lib/format';
import { fillTemplate, varsFor, waNumber } from '@/lib/templates';
import { logNotification, setExamResult } from '@/app/admin/actions';

type Props = { rows: any[]; templates: any[]; site: string; showSchedule?: boolean; canResult?: boolean };

export default function ApplicantTable({ rows, templates, site, showSchedule = true, canResult = true }: Props) {
  const router = useRouter(); const [pending, start] = useTransition(); const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const paidIds = useMemo(() => rows.filter(r => r.status === 'paid').map(r => r.id), [rows]);
  const waitingIds = useMemo(() => rows.filter(r => r.status === 'paid' && !r.exam_result).map(r => r.id), [rows]);
  const selPaid = Array.from(sel).filter(id => paidIds.includes(id));
  const mark = (result: 'kompeten' | 'belum_kompeten' | null) => {
    if (!selPaid.length) return;
    const label = result === 'kompeten' ? 'KOMPETEN' : result === 'belum_kompeten' ? 'BELUM KOMPETEN' : 'belum Ujikom (hasil dihapus)';
    if (!confirm(`Tandai ${selPaid.length} peserta sebagai ${label}?`)) return;
    start(async () => { setMsg(null); const r = await setExamResult(selPaid, result); if (!r.ok) return setMsg({ t: 'err', m: r.error || 'Gagal.' });
      setMsg({ t: 'ok', m: `${r.data.done} peserta ditandai ${label}.${r.data.skipped ? ` ${r.data.skipped} dilewati karena belum Lunas.` : ''}` }); setSel(new Set()); router.refresh(); });
  };
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allChecked = rows.length > 0 && rows.every(r => sel.has(r.id));
  const download = (ids: string[]) => { if (ids.length) window.location.href = `/admin/export?ids=${ids.join(',')}`; };

  function sendWa(r: any, key: string) {
    const t = templates.find(x => x.key === key);
    if (!t) return;
    const text = fillTemplate(t.body, varsFor(r, site));
    window.open(`https://wa.me/${waNumber(r.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    logNotification(r.id, key);
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => setSel(new Set(paidIds))} disabled={!paidIds.length}>Pilih semua yang lunas ({paidIds.length})</button>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => setSel(new Set())} disabled={!sel.size}>Kosongkan</button>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => download(Array.from(sel))} disabled={!sel.size}>⬇ Download yang dicentang ({sel.size})</button>
        <span className="muted small">Excel + 1 folder dokumen per peserta.</span>
      </div>
      {canResult && <div className="row" style={{ marginBottom: 10, padding: '10px 12px', background: 'var(--blue-soft, #EEF3FB)', borderRadius: 10, gap: 8 }}>
        <b className="small">Hasil Ujikom:</b>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => setSel(new Set(waitingIds))} disabled={!waitingIds.length}>Pilih yang belum ada hasil ({waitingIds.length})</button>
        <button className="btn btn-primary btn-sm" type="button" disabled={pending || !selPaid.length} onClick={() => mark('kompeten')}>✅ Tandai Kompeten ({selPaid.length})</button>
        <button className="btn btn-outline btn-sm" type="button" disabled={pending || !selPaid.length} onClick={() => mark('belum_kompeten')}>Belum Kompeten ({selPaid.length})</button>
        <button className="btn btn-outline btn-sm" type="button" disabled={pending || !selPaid.length} onClick={() => mark(null)} title="Hapus hasil (kembali ke Lunas)">↺ Batalkan hasil</button>
      </div>}
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr>
          <th><input type="checkbox" aria-label="Pilih semua" checked={allChecked} onChange={() => setSel(allChecked ? new Set() : new Set(rows.map(r => r.id)))} /></th>
          <th>Nama</th><th>Skema</th><th>Status</th>{showSchedule && <th>Jadwal & sesi</th>}<th>Koordinator</th><th>Pengalaman</th><th>Sisfo</th><th>Sert. BNSP</th><th>No. Reg</th><th>Kirim WA</th>
        </tr></thead>
        <tbody>
          {rows.map(r => {
            const st = statusOf(r); const s = r.exam_sessions; const j = s?.exam_schedules;
            return (
              <tr key={r.id}>
                <td><input type="checkbox" aria-label={`Pilih ${r.full_name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td><Link href={`/admin/pendaftar/${r.id}`}>{r.full_name || '(belum diisi)'}</Link><div className="muted small">{r.phone}</div></td>
                <td>{r.schemes?.name}<div className="muted small">{r.amount != null ? rupiah(r.amount) : 'harga belum dikunci'}</div></td>
                <td><span className={`badge ${st.tone}`}>{st.label}</span></td>
                {showSchedule && <td className="small">{j ? <>{tanggal(j.exam_date)}<div className="muted">{s.name} {jam(s.start_time)}–{jam(s.end_time)} · {j.tuk}</div></> : '-'}</td>}
                <td className="small">{r.coordinators?.code || <span className="muted">—</span>}</td>
                <td>{r.experience_years != null ? `${r.experience_years} th` : '-'}</td>
                <td>{(r.application_documents || []).some((d: any) => d.doc_type === 'screenshot_sisfo' && d.is_current) ? <span className="badge green">✓</span> : <span className="badge grey">belum</span>}</td>
                <td>{r.exam_result === 'kompeten' ? ((r.application_documents || []).some((d: any) => d.doc_type === 'sertifikat_bnsp' && d.is_current) ? <span className="badge green">✓ ada</span> : <span className="badge amber">belum upload</span>) : <span className="muted small">—</span>}</td>
                <td className="small">{r.reg_code || '-'}</td>
                <td>
                  <select aria-label="Pilih template WA" defaultValue="" disabled={!r.phone}
                    onChange={e => { if (e.target.value) sendWa(r, e.target.value); e.target.value = ''; }}
                    style={{ font: 'inherit', fontSize: 13, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #1FAF57' }}>
                    <option value="">💬 Pilih pesan…</option>
                    {templates.map(t => <option key={t.key} value={t.key}>{t.title}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={11} className="muted">Tidak ada data.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
