import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  await createClient().auth.signOut();
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${site}/masuk`);
}
