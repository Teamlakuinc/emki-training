import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Role = 'super_admin' | 'admin' | 'verifikator' | 'participant';

/** Wajib login + role staf + verifikasi 2 langkah (aal2). */
export async function requireStaff(level: 'staff' | 'admin' | 'super' = 'staff') {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/masuk?next=/admin');
  const { data: prof } = await supabase.from('profiles').select('role,full_name,email').eq('id', user.id).single();
  const role = (prof?.role || 'participant') as Role;
  if (!['super_admin', 'admin', 'verifikator'].includes(role)) redirect('/akun');
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/admin/mfa');
  if (level === 'admin' && !['super_admin', 'admin'].includes(role)) redirect('/admin?akses=ditolak');
  if (level === 'super' && role !== 'super_admin') redirect('/admin?akses=ditolak');
  return { supabase, user, role, name: prof?.full_name || prof?.email || user.email };
}

export const isAdminRole = (r: Role) => r === 'super_admin' || r === 'admin';
