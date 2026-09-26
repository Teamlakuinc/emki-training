import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const REF_COOKIE = 'emki_ref';

/** Koordinator dari link referral (cookie), atau null. */
export async function refCoordinatorId(): Promise<string | null> {
  const code = cookies().get(REF_COOKIE)?.value;
  if (!code) return null;
  const { data } = await createClient().rpc('resolve_coordinator', { p_code: code });
  return (data as string) || null;
}
