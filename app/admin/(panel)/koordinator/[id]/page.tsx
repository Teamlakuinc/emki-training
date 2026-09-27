import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireStaff } from '@/lib/admin';
import { STATUS, rupiah, tanggal } from '@/lib/format';
import CoordinatorForm from '@/components/admin/CoordinatorForm';
import PayoutButton from '@/components/admin/PayoutButton';

export default async function Page({ params }: { params: { id: string } }) {
  const { supabase } = await requireStaff('admin');
  const { data: c } = await supabase.from('coordinators').select('*').eq('id', params.id).maybeSingle();
  if (!c) notFound();
  const [{ data: schemes }, { data: markups }, { data: apps }] = await Promise.all([
    supabase.from('schemes').select('id,name').order('level_order'),
    supabase.from('coordinator_markups').select('*').eq('coordinator_id', c.id),
    supabase.from('applications').select('id,reg_code,full_name,phone,status,amount,base_amount,markup_amount,markup_paid_at,paid_at,schemes!applications_scheme_id_fkey(name),exam_sessions(exam_schedules(exam_date,tuk))')
      .eq('coordinator_id', c.id).neq('status', 'draft').order('submitted_at', { ascending: false }),
  ]);
  const paid = (apps || []).filter((a: any) => a.status === 'paid');
  const totalMarkup = paid.reduce((n: number, a: any) => n + Number(a.markup_amount || 0), 0);
  const unpaidMarkup = paid.filter((a: any) => !a.markup_paid_at).reduce((n: number, a: any) => n + Number(a.markup_amount || 0), 0);
  const potential = (apps || []).filter((a: any) => ['submitted', 'recommended', 'awaiting_payment', 'revision_required'].includes(a.status)).reduce((n: number, a: any) => n + Number(a.markup_amount || 0), 0);
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  return (
    <>
      <a href="/admin/koordinator" className="small">← Semua koordinator</a>
      <h1 style={{ marginTop: 6 }}>{c.name}</h1>
      <p>Link referral: <code>{site}/r/{c.code}</code><br /><span className="muted small">Link langsung ke skema tertentu: <code>{site}/r/{c.code}?ke=/daftar/cook</code></span></p>
      <div className="stats">
        <div className="stat"><b>{(apps || []).length}</b><span>Pendaftar</span></div>
        <div className="stat"><b>{paid.length}</b><span>Lunas</span></div>
        <div className="stat"><b style={{ fontSize: 20 }}>{rupiah(totalMarkup)}</b><span>Total markup (peserta lunas)</span></div>
        <div className="stat hot"><b style={{ fontSize: 20 }}>{rupiah(unpaidMarkup)}</b><span>Harus dibayarkan ke koordinator</span></div>
        <div className="stat"><b style={{ fontSize: 20 }}>{rupiah(totalMarkup - unpaidMarkup)}</b><span>Sudah dibayarkan</span></div>
      </div>
      <p className="muted small">Markup dihitung hanya dari peserta yang sudah <b>lunas</b>. Peserta yang belum bayar (potensi {rupiah(potential)}) belum masuk hitungan.</p>
      <div style={{ marginBottom: 16 }}><PayoutButton coordinatorId={c.id} unpaid={unpaidMarkup} /></div>
      <div className="row between"><h2>Peserta</h2><a className="btn btn-primary btn-sm" href={`/admin/koordinator-export/${c.id}`}>⬇ Download laporan Excel</a></div>
      <div className="tbl-wrap" style={{ marginBottom: 24 }}><table className="tbl">
        <thead><tr><th>Nama</th><th>Skema</th><th>Jadwal</th><th>Status</th><th>Harga dasar</th><th>Markup</th><th>Dibayar peserta</th><th>Ke koordinator</th></tr></thead>
        <tbody>{(apps || []).map((a: any) => <tr key={a.id}><td><Link href={`/admin/pendaftar/${a.id}`}>{a.full_name}</Link><div className="muted small">{a.reg_code}</div></td>
          <td>{a.schemes?.name}</td><td className="small">{a.exam_sessions?.exam_schedules ? `${tanggal(a.exam_sessions.exam_schedules.exam_date)} · ${a.exam_sessions.exam_schedules.tuk}` : '-'}</td>
          <td><span className={`badge ${STATUS[a.status].tone}`}>{STATUS[a.status].label}</span></td>
          <td>{rupiah(a.base_amount)}</td><td>{rupiah(a.markup_amount)}</td><td><b>{rupiah(a.amount)}</b></td><td className="small">{a.status !== 'paid' ? '—' : a.markup_paid_at ? `Dibayar ${tanggal(a.markup_paid_at.slice(0, 10))}` : <span className="badge amber">Belum</span>}</td></tr>)}
          {!apps?.length && <tr><td colSpan={8} className="muted">Belum ada pendaftar.</td></tr>}</tbody>
      </table></div>
      <div className="card"><h2>Pengaturan koordinator</h2><CoordinatorForm c={c} schemes={schemes || []} markups={markups || []} /></div>
    </>
  );
}
