'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { STATUS, rupiah, tanggal, jam } from '@/lib/format';
import { fillTemplate, varsFor, waNumber } from '@/lib/templates';
import { logNotification } from '@/app/admin/actions';

type Props = { rows: any[]; templates: any[]; site: string; showSchedule?: boolean };

export default function ApplicantTable({ rows, templates, site, showSchedule = true }: Props) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const paidIds = useMemo(() => rows.filter(r => r.status === 'paid').map(r => r.id), [rows]);
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
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr>
          <th><input type="checkbox" aria-label="Pilih semua" checked={allChecked} onChange={() => setSel(allChecked ? new Set() : new Set(rows.map(r => r.id)))} /></th>
          <th>Nama</th><th>Skema</th><th>Status</th>{showSchedule && <th>Jadwal & sesi</th>}<th>Pengalaman</th><th>Sisfo</th><th>No. Reg</th><th>Kirim WA</th>
        </tr></thead>
        <tbody>
          {rows.map(r => {
            const st = STATUS[r.status]; const s = r.exam_sessions; const j = s?.exam_schedules;
            return (
              <tr key={r.id}>
                <td><input type="checkbox" aria-label={`Pilih ${r.full_name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td><Link href={`/admin/pendaftar/${r.id}`}>{r.full_name || '(belum diisi)'}</Link><div className="muted small">{r.phone}</div></td>
                <td>{r.schemes?.name}<div className="muted small">{rupiah(r.amount ?? r.schemes?.price)}</div></td>
                <td><span className={`badge ${st.tone}`}>{st.label}</span></td>
                {showSchedule && <td className="small">{j ? <>{tanggal(j.exam_date)}<div className="muted">{s.name} {jam(s.start_time)}–{jam(s.end_time)} · {j.tuk}</div></> : '-'}</td>}
                <td>{r.experience_years != null ? `${r.experience_years} th` : '-'}</td>
                <td>{(r.application_documents || []).some((d: any) => d.doc_type === 'screenshot_sisfo' && d.is_current) ? <span className="badge green">✓</span> : <span className="badge grey">belum</span>}</td>
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
          {!rows.length && <tr><td colSpan={9} className="muted">Tidak ada data.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
