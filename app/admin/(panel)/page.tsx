import Link from 'next/link';
import { requireStaff } from '@/lib/admin';
import { rupiah, tanggal } from '@/lib/format';

export default async function Dashboard({ searchParams }: { searchParams: { akses?: string } }) {
  const { supabase } = await requireStaff();
  const { data: s } = await supabase.rpc('admin_dashboard_stats');
  const st: any = s || {};
  const { data: sched } = await supabase.from('exam_schedules').select('id,title,exam_date,tuk,status').in('status', ['open', 'closed']).order('exam_date').limit(6);
  const card = (href: string, n: any, label: string, hot = false) =>
    <Link className={`stat ${hot && n > 0 ? 'hot' : ''}`} href={href}><b>{n ?? 0}</b><span>{label}</span></Link>;
  return (
    <>
      {searchParams.akses && <div className="alert alert-warn">Halaman tersebut hanya untuk Admin.</div>}
      <h1>Dashboard</h1>
      <div className="stats">
        {card('/admin/pendaftar?status=submitted', st.menunggu_verifikasi, 'Menunggu verifikasi', true)}
        {card('/admin/pendaftar?status=awaiting_payment', st.menunggu_bayar, 'Menunggu pembayaran')}
        {card('/admin/pendaftar?status=paid', st.lunas, 'Lunas')}
        {card('/admin/pendaftar?status=revision_required', st.perlu_perbaikan, 'Perlu perbaikan')}
        {card('/admin/pendaftar?status=recommended', st.rekomendasi, 'Menunggu jawaban rekomendasi')}
        {card('/admin/pendaftar?status=draft', st.draft, 'Draft (belum dikirim)')}
        {card('/admin/jadwal', st.jadwal_aktif, 'Jadwal dibuka')}
        <div className="stat"><b style={{ fontSize: 20 }}>{rupiah(st.pendapatan)}</b><span>Total lunas</span></div>
      </div>
      <h2>Jadwal Ujikom terdekat</h2>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Tanggal</th><th>Jadwal</th><th>TUK</th><th>Status</th></tr></thead><tbody>
        {(sched || []).map(j => <tr key={j.id}><td>{tanggal(j.exam_date)}</td><td><Link href={`/admin/jadwal/${j.id}`}>{j.title}</Link></td><td>{j.tuk}</td><td>{j.status}</td></tr>)}
        {(!sched || !sched.length) && <tr><td colSpan={4} className="muted">Belum ada jadwal dibuka.</td></tr>}
      </tbody></table></div>
    </>
  );
}
