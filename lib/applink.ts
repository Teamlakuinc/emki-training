import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** Ambil UUID dari potongan link (WA kadang menambah titik/koma/spasi di ujung link). */
export function cleanId(raw: string) {
  const m = decodeURIComponent(raw || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0].toLowerCase() : null;
}

/** an***@gmail.com */
export function maskEmail(e?: string | null) {
  if (!e || !e.includes('@')) return '';
  const [u, d] = e.split('@');
  return `${u.slice(0, Math.min(2, u.length))}${'*'.repeat(Math.max(3, u.length - 2))}@${d}`;
}

/** Cari pemilik pendaftaran (pakai service role, hanya di server). */
export async function ownerOf(id: string) {
  const db = createAdminClient();
  const { data: a } = await db.from('applications').select('id,user_id,full_name').eq('id', id).maybeSingle();
  if (!a) return null;
  const { data: p } = await db.from('profiles').select('email').eq('id', a.user_id).maybeSingle();
  return { name: a.full_name as string | null, email: (p?.email as string) || '' };
}
