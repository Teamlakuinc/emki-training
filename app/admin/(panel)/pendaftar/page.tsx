import { requireStaff, isAdminRole } from '@/lib/admin';
import ApplicantBrowser from '@/components/admin/ApplicantBrowser';
import { APP_SELECT } from '@/lib/queries';

export default async function Page({ searchParams }: { searchParams: { status?: string; q?: string; skema?: string; dihapus?: string; koordinator?: string; urut?: string } }) {
  const { supabase, role } = await requireStaff();
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  // Semua pendaftar dimuat sekali; tab, pencarian, filter & urutan berjalan langsung di browser (tanpa reload).
  const [{ data: rows }, { data: schemes }, { data: coords }, { data: templates }] = await Promise.all([
    supabase.from('applications').select(APP_SELECT).order('submitted_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(5000),
    supabase.from('schemes').select('id,name').order('level_order'),
    supabase.from('coordinators').select('id,name,code').order('name'),
    supabase.from('message_templates').select('key,title,body').eq('channel', 'whatsapp').eq('is_active', true).order('sort_order'),
  ]);
  return (
    <>
      {searchParams.dihapus && <div className="alert alert-ok">Pendaftaran telah dihapus.</div>}
      <ApplicantBrowser rows={rows || []} templates={templates || []} site={site} canResult={isAdminRole(role)}
        schemes={schemes || []} coords={coords || []} initial={searchParams} />
    </>
  );
}
