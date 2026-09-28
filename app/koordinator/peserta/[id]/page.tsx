import { notFound } from 'next/navigation';
import { requireCoordinator } from '@/lib/admin';
import CoordDetail from '@/components/CoordDetail';

export default async function Page({ params }: { params: { id: string } }) {
  const { supabase, coord } = await requireCoordinator();
  const { data: a } = await supabase.from('applications')
    .select('*, schemes!applications_scheme_id_fkey(name), exam_sessions(name,start_time,end_time,exam_schedules(exam_date,tuk))').eq('id', params.id).maybeSingle();
  if (!a || a.coordinator_id !== coord.id) notFound();
  const [{ data: docs }, { data: req }, { data: hasSecret }] = await Promise.all([
    supabase.from('application_documents').select('doc_type,storage_path,file_name,version').eq('application_id', a.id).eq('is_current', true),
    supabase.from('required_documents').select('code,name,description,accept,filled_by').eq('is_active', true).order('sort_order'),
    supabase.rpc('has_siapkerja_secret', { p_application: a.id }),
  ]);
  const urls: Record<string, string> = {};
  for (const d of docs || []) { const { data } = await supabase.storage.from('application-documents').createSignedUrl(d.storage_path, 600); if (data) urls[d.doc_type] = data.signedUrl; }
  return <CoordDetail a={a} docs={docs || []} urls={urls} hasSecret={!!hasSecret}
    staffDocs={(req || []).filter((d: any) => d.filled_by === 'staff')} partDocs={(req || []).filter((d: any) => d.filled_by !== 'staff')} />;
}
