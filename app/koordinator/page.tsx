import { requireCoordinator } from '@/lib/admin';
import { rupiah } from '@/lib/format';
import CoordTable from '@/components/CoordTable';

export default async function Page() {
  const { supabase, coord } = await requireCoordinator();
  const { data: rows } = await supabase.from('applications')
    .select('id,reg_code,full_name,phone,status,amount,commission_amount,markup_paid_at,schemes!applications_scheme_id_fkey(name),exam_sessions(exam_schedules(exam_date,tuk)),application_documents(doc_type,is_current)')
    .eq('coordinator_id', coord.id).order('created_at', { ascending: false });
  const all = rows || [];
  const paid = all.filter((a: any) => a.status === 'paid');
  const total = paid.reduce((n: number, a: any) => n + Number(a.commission_amount || 0), 0);
  const unpaid = paid.filter((a: any) => !a.markup_paid_at).reduce((n: number, a: any) => n + Number(a.commission_amount || 0), 0);
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  return (<>
    <h1>Peserta saya</h1>
    <div className="card" style={{ marginBottom: 16 }}>
      <b>Link referral Anda:</b> <code>{site}/r/{coord.code}</code>
      <p className="muted small" style={{ margin: '6px 0 0' }}>Langsung ke skema tertentu: <code>{site}/r/{coord.code}?ke=/daftar/cook</code> (ganti <code>cook</code> dengan demi-chef, chef-de-partie, sous-chef, atau executive-chef).</p>
    </div>
    <div className="stats">
      <div className="stat"><b>{all.filter((a: any) => a.status !== 'draft').length}</b><span>Pendaftar</span></div>
      <div className="stat"><b>{paid.length}</b><span>Lunas</span></div>
      <div className="stat"><b style={{ fontSize: 20 }}>{rupiah(total)}</b><span>Total komisi</span></div>
      <div className="stat hot"><b style={{ fontSize: 20 }}>{rupiah(unpaid)}</b><span>Komisi belum dibayarkan</span></div>
    </div>
    <p className="muted small">Komisi dihitung dari peserta yang sudah lunas. Upload screenshot Sisfo BNSP di halaman tiap peserta.</p>
    <CoordTable rows={all.filter((a: any) => a.status !== 'draft').concat(all.filter((a: any) => a.status === 'draft'))} />
  </>);
}
