import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cleanId, maskEmail, ownerOf } from '@/lib/applink';
import BedaAkun from './BedaAkun';
import Wizard from '@/components/Wizard';
import Link from 'next/link';
import { claimFromCookie } from '@/lib/ref';
import { paymentMethod } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Formulir Pendaftaran' };

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await claimFromCookie(user);
  // link dari WA kadang ikut tanda baca di ujungnya → rapikan dulu
  const id = cleanId(params.id);
  if (!id) notFound();
  if (id !== params.id) redirect(`/akun/pendaftaran/${id}`);
  const { data: app } = await supabase.from('applications')
    .select('*, schemes!applications_scheme_id_fkey(id,slug,name,price,requires_verification)').eq('id', id).maybeSingle();
  if (!app || app.user_id !== user!.id) {
    // staf / koordinator yang membuka link peserta → arahkan ke halaman kelolanya
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user!.id).maybeSingle();
    const role = (prof?.role as string) || 'participant';
    if (['super_admin', 'admin', 'verifikator'].includes(role)) redirect(`/admin/pendaftar/${id}`);
    if (role === 'koordinator') redirect(`/koordinator/peserta/${id}`);
    // peserta yang masuk dengan akun lain → beri tahu akun yang benar
    const owner = await ownerOf(id);
    if (!owner) notFound();
    return <BedaAkun id={id} ownerMasked={maskEmail(owner.email)} myEmail={user!.email || ''} />;
  }
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
  const method = await paymentMethod();
  const { data: banks } = method === 'doku' ? { data: [] as any[] } : await supabase.from('bank_accounts').select('bank,account_number,account_name').eq('is_active', true).order('sort_order');
  let recSessions: any[] = [];
  if (recR.data) {
    const { data: rs } = await supabase.rpc('available_sessions', { p_scheme_slug: recR.data.slug, p_coordinator: app.coordinator_id });
    recSessions = rs || [];
  }
  const applies = (r: any) => !r.scheme_ids || r.scheme_ids.length === 0 || r.scheme_ids.includes(app.scheme_id);

  return (<>
    {app.siapkerja_fix_requested_at && (
      <div className="alert alert-warn" style={{ maxWidth: 820, margin: '0 auto 16px' }}>
        ⚠️ <b>Akun SIAPkerja Anda tidak bisa diakses.</b> Kendala: {app.siapkerja_fix_note || '-'}.{' '}
        <Link className="btn btn-primary btn-sm" href={`/akun/pendaftaran/${app.id}/siapkerja`} style={{ marginLeft: 6 }}>Perbaiki sekarang</Link>
      </div>)}
    <Wizard app={app} scheme={scheme} userId={user!.id} sessions={(sessR.data as any[]) || []} current={curR.data}
      docs={docsR.data || []} hasSecret={!!secretR.data} logs={logsR.data || []} recommended={recR.data} recSessions={recSessions}
      method={method} banks={banks || []} proofs={proofsR.data || []} clientKey="" prod={false}
      reqDocs={(reqR.data || []).filter(applies)} fields={(fieldsR.data || []).filter(applies)} />
  </>);
}
