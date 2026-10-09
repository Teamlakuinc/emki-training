'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminConfirmUsers } from '@/app/admin/actions';
import { STATUS, waktu } from '@/lib/format';
import { fillTemplate, waNumber } from '@/lib/templates';

export default function AccountsTable({ rows, tpl, site, unconfirmedCount = 0 }: { rows: any[]; tpl: string; site: string; unconfirmedCount?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const confirmUsers = (ids: string[] | 'all', label: string) => {
    if (!confirm(label)) return;
    start(async () => { const r = await adminConfirmUsers(ids); setMsg(r.ok ? { t: 'ok', m: `${r.data.count} akun diaktifkan. Peserta sekarang bisa langsung masuk.` } : { t: 'err', m: r.error! }); router.refresh(); });
  };
  const send = (r: any) => {
    const text = fillTemplate(tpl, { nama: r.full_name || '', link: r.app ? `${site}/akun/pendaftaran/${r.app.id}` : `${site}/` });
    window.open(`https://wa.me/${waNumber(r.phone_wa)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  return (<>{msg && <div className={`alert alert-${msg.t}`}>{msg.m}</div>}<div className="tbl-wrap"><table className="tbl">
    <thead><tr><th>Nama</th><th>WhatsApp</th><th>Email</th><th>Buat akun</th><th>Pendaftaran</th><th>Koordinator</th><th></th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.id}>
      <td>{r.full_name || '—'}</td><td>{r.phone_wa || <span className="muted">—</span>}</td><td className="small">{r.email}{r.unconfirmed && <div><span className="badge amber">Belum konfirmasi email</span></div>}</td><td className="small">{waktu(r.created_at)}</td>
      <td>{r.app ? <Link href={`/admin/pendaftar/${r.app.id}`}><span className={`badge ${STATUS[r.app.status].tone}`}>{STATUS[r.app.status].label}</span></Link> : <span className="badge grey">Belum mulai</span>}</td>
      <td className="small">{r.coord || '—'}</td>
      <td><div className="row" style={{ gap: 6 }}>{r.unconfirmed && <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => confirmUsers([r.id], `Aktifkan akun ${r.email}?`)}>✓ Aktifkan</button>}
        {r.phone_wa && <button className="btn btn-wa btn-sm" onClick={() => send(r)}>💬 Ingatkan</button>}</div></td></tr>)}
      {!rows.length && <tr><td colSpan={7} className="muted">Tidak ada data.</td></tr>}</tbody>
  </table></div>
  {unconfirmedCount > 0 && <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} disabled={pending} onClick={() => confirmUsers('all', `Aktifkan semua ${unconfirmedCount} akun yang belum konfirmasi email?`)}>✓ Aktifkan semua akun yang belum konfirmasi ({unconfirmedCount})</button>}
  </>);
}
