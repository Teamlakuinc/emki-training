'use client';
import Link from 'next/link';
import { STATUS, waktu } from '@/lib/format';
import { fillTemplate, waNumber } from '@/lib/templates';

export default function AccountsTable({ rows, tpl, site }: { rows: any[]; tpl: string; site: string }) {
  const send = (r: any) => {
    const text = fillTemplate(tpl, { nama: r.full_name || '', link: r.app ? `${site}/akun/pendaftaran/${r.app.id}` : `${site}/` });
    window.open(`https://wa.me/${waNumber(r.phone_wa)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  return (<div className="tbl-wrap"><table className="tbl">
    <thead><tr><th>Nama</th><th>WhatsApp</th><th>Email</th><th>Buat akun</th><th>Pendaftaran</th><th>Koordinator</th><th></th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.id}>
      <td>{r.full_name || '—'}</td><td>{r.phone_wa || <span className="muted">—</span>}</td><td className="small">{r.email}</td><td className="small">{waktu(r.created_at)}</td>
      <td>{r.app ? <Link href={`/admin/pendaftar/${r.app.id}`}><span className={`badge ${STATUS[r.app.status].tone}`}>{STATUS[r.app.status].label}</span></Link> : <span className="badge grey">Belum mulai</span>}</td>
      <td className="small">{r.coord || '—'}</td>
      <td>{r.phone_wa && <button className="btn btn-wa btn-sm" onClick={() => send(r)}>💬 Ingatkan</button>}</td></tr>)}
      {!rows.length && <tr><td colSpan={7} className="muted">Tidak ada data.</td></tr>}</tbody>
  </table></div>);
}
