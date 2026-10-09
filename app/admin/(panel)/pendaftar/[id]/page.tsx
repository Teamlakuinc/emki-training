import { notFound } from 'next/navigation';
import { requireStaff, isAdminRole } from '@/lib/admin';
import Detail from '@/components/admin/Detail';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function Page({ params }: { params: { id: string } }) {
  const { supabase, role } = await requireStaff();
  const { data: a } = await supabase.from('applications')
    .select('*, coordinators(name,code), schemes!applications_scheme_id_fkey(id,name,price,requires_verification), rec:schemes!applications_recommended_scheme_id_fkey(name), orig:schemes!applications_original_scheme_id_fkey(name), exam_sessions(id,name,start_time,end_time,exam_schedules(id,title,exam_date,tuk,address))')
    .eq('id', params.id).maybeSingle();
  if (!a) notFound();
  // email akun login peserta (bisa beda dengan email di formulir)
  const { data: owner } = await createAdminClient().from('profiles').select('email').eq('id', a.user_id).maybeSingle();
  (a as any).account_email = owner?.email || '';
  const [{ data: docs }, { data: logs }, { data: schemes }, { data: templates }, { data: hasSecret }, { data: notifs }] = await Promise.all([
    supabase.from('application_documents').select('doc_type,storage_path,file_name,version,created_at').eq('application_id', a.id).eq('is_current', true),
    supabase.from('verification_logs').select('decision,note,created_at,profiles(full_name,email)').eq('application_id', a.id).order('created_at', { ascending: false }),
    supabase.from('schemes').select('id,name,price').order('level_order'),
    supabase.from('message_templates').select('key,title,body').eq('channel', 'whatsapp').eq('is_active', true).order('sort_order'),
    supabase.rpc('has_siapkerja_secret', { p_application: a.id }),
    supabase.from('notification_logs').select('template_key,created_at,profiles(full_name,email)').eq('application_id', a.id).order('created_at', { ascending: false }).limit(10),
  ]);
  const [{ data: reqDocs }, { data: fields }] = await Promise.all([
    supabase.from('required_documents').select('code,name,description,accept,is_required,scheme_ids,filled_by').order('sort_order'),
    supabase.from('custom_fields').select('code,label,scheme_ids,field_type,options,is_active').order('sort_order'),
  ]);
  // sesi lain yang menguji skema ini (untuk pindah sesi)
  const { data: sess } = await supabase.from('exam_sessions')
    .select('id,name,start_time,end_time,quota,exam_schedules!inner(id,title,exam_date,tuk,status,exam_schedule_schemes!inner(scheme_id))')
    .eq('exam_schedules.exam_schedule_schemes.scheme_id', a.scheme_id).order('start_time');
  const { data: proofs } = await supabase.from('payment_proofs').select('id,status,amount,sender_name,sender_bank,transfer_date,review_note,created_at,storage_path').eq('application_id', a.id).order('created_at', { ascending: false });
  const proofUrls: Record<string, string> = {};
  for (const pf of proofs || []) { const { data } = await supabase.storage.from('application-documents').createSignedUrl(pf.storage_path, 600); if (data) proofUrls[pf.id] = data.signedUrl; }
  const [{ data: coordList }, { data: changeLogs }] = await Promise.all([
    supabase.from('coordinators').select('id,name,code').order('name'),
    supabase.from('admin_change_logs').select('id,action,detail,created_at,profiles(full_name,email)').eq('application_id', a.id).order('created_at', { ascending: false }).limit(30),
  ]);
  // riwayat versi dokumen (untuk dibuka / dipakai kembali)
  const { data: allDocs } = await supabase.from('application_documents').select('id,doc_type,storage_path,file_name,version,is_current,created_at').eq('application_id', a.id).order('version', { ascending: false });
  const history = (allDocs || []).filter((d: any) => !d.is_current);
  const histUrls: Record<string, string> = {};
  if (history.length) {
    const { data: signed } = await supabase.storage.from('application-documents').createSignedUrls(history.map((d: any) => d.storage_path), 600);
    (signed || []).forEach((x: any, i: number) => { if (x.signedUrl) histUrls[history[i].id] = x.signedUrl; });
  }
  const urls: Record<string, string> = {};
  for (const d of docs || []) {
    const { data } = await supabase.storage.from('application-documents').createSignedUrl(d.storage_path, 600);
    if (data) urls[d.doc_type] = data.signedUrl;
  }
  return <Detail a={a} docs={docs || []} urls={urls} logs={logs || []} notifs={notifs || []} schemes={schemes || []} templates={templates || []}
    sessions={sess || []} reqDocs={reqDocs || []} fields={fields || []} hasSecret={!!hasSecret} isAdmin={isAdminRole(role)} isSuper={role === 'super_admin'} proofs={proofs || []} proofUrls={proofUrls} coordList={coordList || []} changeLogs={changeLogs || []} history={history} histUrls={histUrls} site={process.env.NEXT_PUBLIC_SITE_URL || ''} />;
}
