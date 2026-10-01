import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Wizard from '@/components/Wizard';
import { paymentMethod } from '@/lib/admin';
import { claimFromCookie } from '@/lib/ref';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Formulir Pendaftaran' };

export default async function Page({ params }: { params: { id: string } }) {
  await claimFromCookie();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: app } = await supabase.from('applications').select('*').eq('id', params.id).maybeSingle();
  if (!app || app.user_id !== user!.id) notFound();

  const [{ data: scheme }, { data: docs }, { data: hasSecret }, { data: logs }] = await Promise.all([
    supabase.from('schemes').select('id,slug,name,price,requires_verification').eq('id', app.scheme_id).single(),
    supabase.from('application_documents').select('doc_type,storage_path,file_name,created_at,version').eq('application_id', app.id).eq('is_current', true),
    supabase.rpc('has_siapkerja_secret', { p_application: app.id }),
    supabase.from('verification_logs').select('decision,note,created_at').eq('application_id', app.id).order('created_at', { ascending: false }).limit(5),
  ]);
  const { data: sessions } = await supabase.rpc('available_sessions', { p_scheme_slug: scheme!.slug, p_coordinator: app.coordinator_id });
  const [{ data: reqDocs }, { data: fields }] = await Promise.all([
    supabase.from('required_documents').select('*').eq('is_active', true).eq('filled_by', 'participant').order('sort_order'),
    supabase.from('custom_fields').select('*').eq('is_active', true).order('sort_order'),
  ]);
  const method = await paymentMethod();
  const [{ data: banks }, { data: proofs }] = await Promise.all([
    supabase.from('bank_accounts').select('bank,account_number,account_name').eq('is_active', true).order('sort_order'),
    supabase.from('payment_proofs').select('status,review_note,created_at,sender_name,sender_bank,transfer_date').eq('application_id', app.id).order('created_at', { ascending: false }).limit(3),
  ]);
  const applies = (r: any) => !r.scheme_ids || r.scheme_ids.length === 0 || r.scheme_ids.includes(app.scheme_id);

  // info sesi yang sedang dipilih (bisa saja sudah tidak "tersedia" karena penuh/ditutup)
  let current: any = null;
  if (app.session_id) {
    const { data } = await supabase.from('exam_sessions')
      .select('id,name,start_time,end_time,exam_schedules(title,exam_date,tuk,address)').eq('id', app.session_id).maybeSingle();
    current = data;
  }
  let recommended: any = null, recSessions: any[] = [];
  if (app.status === 'recommended' && app.recommended_scheme_id) {
    const { data } = await supabase.from('schemes').select('id,slug,name,price').eq('id', app.recommended_scheme_id).single();
    recommended = data;
    const { data: rs } = await supabase.rpc('available_sessions', { p_scheme_slug: data!.slug, p_coordinator: app.coordinator_id });
    recSessions = rs || [];
  }

  return (
    <Wizard app={app} scheme={scheme} userId={user!.id} sessions={sessions || []} current={current}
      docs={docs || []} hasSecret={!!hasSecret} logs={logs || []} recommended={recommended} recSessions={recSessions}
      method={method} banks={banks || []} proofs={proofs || []} clientKey={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''} prod={process.env.MIDTRANS_IS_PRODUCTION === 'true'}
      reqDocs={(reqDocs || []).filter(applies)} fields={(fields || []).filter(applies)} />
  );
}
