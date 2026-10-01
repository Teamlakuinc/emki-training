import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const REF_COOKIE = 'emki_ref';
export const refCode = () => cookies().get(REF_COOKIE)?.value || null;

/** Koordinator yang berlaku: dari akun (jika login & sudah terkunci), lalu dari cookie link referral. */
export async function refCoordinatorId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await claimFromCookie();
    const { data: p } = await supabase.from('profiles').select('coordinator_id').eq('id', user.id).maybeSingle();
    if (p?.coordinator_id) return p.coordinator_id;
  }
  const code = refCode();
  if (!code) return null;
  const { data } = await supabase.rpc('resolve_coordinator', { p_code: code });
  return (data as string) || null;
}

/** Jika peserta login dan browser membawa kode referral, kunci ke akunnya (koordinator pertama yang menang). */
export async function claimFromCookie() {
  const code = refCode();
  if (!code) return;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('claim_referral', { p_code: code });
}
