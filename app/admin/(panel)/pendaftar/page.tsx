import { requireStaff } from '@/lib/admin';
import { STATUS } from '@/lib/format';
import ApplicantTable from '@/components/admin/ApplicantTable';
import { APP_SELECT } from '@/lib/queries';



export default async function Page({ searchParams }: { searchParams: { status?: string; q?: string; skema?: string; dihapus?: string; koordinator?: string } }) {
  const { supabase } = await requireStaff();
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  let q = supabase.from('applications').select(APP_SELECT).order('submitted_at', { ascending: false, nullsFirst: false }).limit(500);
  if (searchParams.status) q = q.eq('status', searchParams.status);
  else q = q.neq('status', 'draft');
  if (searchParams.skema) q = q.eq('scheme_id', searchParams.skema);
  if (searchParams.koordinator === 'tanpa') q = q.is('coordinator_id', null);
  else if (searchParams.koordinator) q = q.eq('coordinator_id', searchParams.koordinator);
  if (searchParams.q) q = q.or(`full_name.ilike.%${searchParams.q.replace(/[%,()]/g, '')}%,reg_code.ilike.%${searchParams.q.replace(/[%,()]/g, '')}%,nik.ilike.%${searchParams.q.replace(/[%,()]/g, '')}%`);
  const [{ data: rows }, { data: schemes }, { data: coords }, { data: templates }] = await Promise.all([
    q, supabase.from('schemes').select('id,name').order('level_order'),
    supabase.from('coordinators').select('id,name,code').order('name'),
    supabase.from('message_templates').select('key,title,body').eq('channel', 'whatsapp').eq('is_active', true).order('sort_order'),
  ]);
  return (
    <>
      <h1>{searchParams.status === 'submitted' ? 'Antrean verifikasi' : 'Pendaftar'}</h1>
      {searchParams.dihapus && <div className="alert alert-ok">Pendaftaran telah dihapus.</div>}
      <form className="toolbar">
        <div className="field"><label htmlFor="q">Cari</label><input id="q" name="q" defaultValue={searchParams.q} placeholder="Nama / NIK / No. reg" /></div>
        <div className="field"><label htmlFor="st">Status</label><select id="st" name="status" defaultValue={searchParams.status || ''}>
          <option value="">Semua (kecuali draft)</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div className="field"><label htmlFor="sk">Skema</label><select id="sk" name="skema" defaultValue={searchParams.skema || ''}>
          <option value="">Semua skema</option>{(schemes || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field"><label htmlFor="kd">Koordinator</label><select id="kd" name="koordinator" defaultValue={searchParams.koordinator || ''}>
          <option value="">Semua</option><option value="tanpa">Tanpa koordinator</option>{(coords || []).map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></div>
        <button className="btn btn-primary btn-sm">Tampilkan</button>
      </form>
      <ApplicantTable rows={rows || []} templates={templates || []} site={site} />
    </>
  );
}
