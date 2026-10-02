import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Wizard from '@/components/Wizard';
import { claimFromCookie } from '@/lib/ref';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Formulir Pendaftaran' };

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await claimFromCookie(user);
  const { data: app } = await supabase.from('applications')
    .select('*, schemes!applications_scheme_id_fkey(id,slug,name,price,requires_verification)').eq('id', params.id).maybeSingle();
  if (!app || app.user_id !== user!.id) notFound();
  const scheme: any = (app as any).schemes;

  // semua data dimuat bersamaan (lebih cepat di HP / sinyal lemah)
  const [docsR, secretR, logsR, sessR, reqR, fieldsR, proofsR, curR, recR] = await Promise.all([
    supabase.from('application_documents').select('doc_type,storage_path,file_name,created_at,version').eq('application_id', app.id).eq('is_current', true),
    supabase.rpc('has_siapkerja_secret', { p_application: app.id }),
    supabase.from('verification_logs').select('decision,note,created_at').eq('application_id', app.id).order('created_at', { ascending: false }).limit(5),
    supabase.rpc('available_sessions', { p_scheme_slug: scheme.slug, p_coordinator: app.coordinator_id }),
    supabase.from('required_documents').select('*').eq('is_active', true).eq('filled_by', 'participant').order('sort_order'),
    supabase.from('custom_fields').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('payment_proofs').select('status,review_note,created_at,sender_name,sender_bank,transfer_date').eq('application_id', app.id).order('created_at', { ascending: false }).limit(3),
    app.session_id ? supabase.from('exam_sessions').select('id,name,start_time,end_time,exam_schedules(title,exam_date,tuk,address)').eq('id', app.session_id).maybeSingle() : Promise.resolve({ data: null } as any),
    app.status === 'recommended' && app.recommended_scheme_id ? supabase.from('schemes').select('id,slug,name,price').eq('id', app.recommended_scheme_id).single() : Promise.resolve({ data: null } as any),
  ]);
  let recSessions: any[] = [];
  if (recR.data) {
    const { data: rs } = await supabase.rpc('available_sessions', { p_scheme_slug: recR.data.slug, p_coordinator: app.coordinator_id });
    recSessions = rs || [];
  }
  const applies = (r: any) => !r.scheme_ids || r.scheme_ids.length === 0 || r.scheme_ids.includes(app.scheme_id);

  return (
    <Wizard app={app} scheme={scheme} userId={user!.id} sessions={(sessR.data as any[]) || []} current={curR.data}
      docs={docsR.data || []} hasSecret={!!secretR.data} logs={logsR.data || []} recommended={recR.data} recSessions={recSessions}
      method="doku" banks={[]} proofs={proofsR.data || []} clientKey="" prod={false}
      reqDocs={(reqR.data || []).filter(applies)} fields={(fieldsR.data || []).filter(applies)} />
  );
}
