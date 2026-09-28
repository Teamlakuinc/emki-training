'use client';
import { useState } from 'react';
import Link from 'next/link';
import { STATUS, rupiah, tanggal } from '@/lib/format';

export default function CoordTable({ rows }: { rows: any[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const paid = rows.filter(r => r.status === 'paid').map(r => r.id);
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (<>
    <div className="row" style={{ marginBottom: 10 }}>
      <button className="btn btn-outline btn-sm" onClick={() => setSel(new Set(paid))} disabled={!paid.length}>Pilih semua yang lunas ({paid.length})</button>
      <button className="btn btn-primary btn-sm" disabled={!sel.size} onClick={() => { window.location.href = `/admin/export?ids=${Array.from(sel).join(',')}`; }}>⬇ Download yang dicentang ({sel.size})</button>
      <span className="muted small">Excel + 1 folder per peserta (4 lampiran).</span>
    </div>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th></th><th>Nama</th><th>Skema</th><th>Jadwal</th><th>Status</th><th>Sisfo</th><th>Dibayar</th><th>Komisi</th></tr></thead>
      <tbody>{rows.map(r => { const st = STATUS[r.status]; const j = r.exam_sessions?.exam_schedules; return (
        <tr key={r.id}><td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Pilih ${r.full_name}`} /></td>
          <td><Link href={`/koordinator/peserta/${r.id}`}>{r.full_name || '(belum diisi)'}</Link><div className="muted small">{r.reg_code || 'draft'} · {r.phone}</div></td>
          <td>{r.schemes?.name}</td><td className="small">{j ? `${tanggal(j.exam_date)} · ${j.tuk}` : '-'}</td>
          <td><span className={`badge ${st.tone}`}>{st.label}</span></td>
          <td>{(r.application_documents || []).some((d: any) => d.doc_type === 'screenshot_sisfo' && d.is_current) ? <span className="badge green">✓</span> : <span className="badge amber">belum</span>}</td>
          <td>{r.amount != null ? rupiah(r.amount) : '-'}</td><td>{r.commission_amount != null ? rupiah(r.commission_amount) : '-'}</td></tr>); })}
        {!rows.length && <tr><td colSpan={8} className="muted">Belum ada peserta yang mendaftar melalui link Anda.</td></tr>}</tbody>
    </table></div>
  </>);
}
