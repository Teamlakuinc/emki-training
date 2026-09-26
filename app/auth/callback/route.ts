import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextRaw = url.searchParams.get('next') || '/akun';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/akun';
  const site = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${site}${next}`);
  }
  return NextResponse.redirect(`${site}/masuk?error=link`);
}
