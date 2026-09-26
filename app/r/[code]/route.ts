import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { REF_COOKIE } from '@/lib/ref';

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const code = (params.code || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
  const { data } = await createClient().rpc('resolve_coordinator', { p_code: code });
  const next = new URL(request.url).searchParams.get('ke');
  const dest = next && /^\/daftar\/[a-z0-9-]+$/.test(next) ? next : '/';
  const res = NextResponse.redirect(`${site}${dest}`);
  if (data) res.cookies.set(REF_COOKIE, code, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  return res;
}
