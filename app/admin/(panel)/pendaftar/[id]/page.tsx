import { notFound } from 'next/navigation';
import { requireStaff, isAdminRole } from '@/lib/admin';
import Detail from '@/components/admin/Detail';

export default async function Page({ params }: { params: { id: string } }) {
  const { supabase, role } = await requireStaff();
  const { data: a } = await supabase.from('applications')
    .select('*, schemes!applications_scheme_id_fkey(id,name,price,requires_verification), rec:schemes!applications_recommended_scheme_id_fkey(name), orig:schemes!applications_original_scheme_id_fkey(name), exam_sessions(id,name,start_time,end_time,exam_schedules(id,title,exam_date,tuk,address))')
    .eq('id', params.id).maybeSingle();
  if (!a) notFound();
  const [{ data: docs }, { data: logs }, { data: schemes }, { data: templates }, { data: hasSecret }, { data: notifs }] = await Promise.all([
    supabase.from('application_documents').select('doc_type,storage_path,file_name,version,created_at').eq('application_id', a.id).eq('is_current', true),
    supabase.from('verification_logs').select('decision,note,created_at,profiles(full_name,email)').eq('application_id', a.id).order('created_at', { ascending: false }),
    supabase.from('schemes').select('id,name,price').eq('is_active', true).order('level_order'),
    supabase.from('message_templates').select('key,title,body').eq('channel', 'whatsapp').eq('is_active', true).order('sort_order'),
    supabase.rpc('has_siapkerja_secret', { p_application: a.id }),
    supabase.from('notification_logs').select('template_key,created_at,profiles(full_name,email)').eq('application_id', a.id).order('created_at', { ascending: false }).limit(10),
  ]);
  const [{ data: reqDocs }, { data: fields }] = await Promise.all([
    supabase.from('required_documents').select('code,name,is_required,scheme_ids').order('sort_order'),
    supabase.from('custom_fields').select('code,label,scheme_ids').order('sort_order'),
  ]);
  // sesi lain yang menguji skema ini (untuk pindah sesi)
  const { data: sess } = await supabase.from('exam_sessions')
    .select('id,name,start_time,end_time,quota,exam_schedules!inner(id,title,exam_date,tuk,status,exam_schedule_schemes!inner(scheme_id))')
    .eq('exam_schedules.exam_schedule_schemes.scheme_id', a.scheme_id).order('start_time');
  const urls: Record<string, string> = {};
  for (const d of docs || []) {
    const { data } = await supabase.storage.from('application-documents').createSignedUrl(d.storage_path, 600);
    if (data) urls[d.doc_type] = data.signedUrl;
  }
  return <Detail a={a} docs={docs || []} urls={urls} logs={logs || []} notifs={notifs || []} schemes={schemes || []} templates={templates || []}
    sessions={sess || []} reqDocs={reqDocs || []} fields={fields || []} hasSecret={!!hasSecret} isAdmin={isAdminRole(role)} site={process.env.NEXT_PUBLIC_SITE_URL || ''} />;
}
