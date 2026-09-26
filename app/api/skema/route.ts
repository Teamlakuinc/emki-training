import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Cache-Control': 'public, max-age=60' };

/** Harga & status skema untuk halaman WordPress (publik, hanya data yang memang tampil ke publik). */
export async function GET() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await sb.from('schemes').select('slug,name,price,requires_verification,is_active,level_order').eq('is_active', true).order('level_order');
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: CORS });
  return NextResponse.json(data, { headers: CORS });
}
export function OPTIONS() { return new NextResponse(null, { headers: CORS }); }
