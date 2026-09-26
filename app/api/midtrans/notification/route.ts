import { NextResponse } from 'next/server';
import { validSignature } from '@/lib/midtrans';
import { applyMidtrans } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let n: any;
  try { n = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!validSignature(n)) return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 403 });
  const r = await applyMidtrans(n);
  // selalu 200 untuk order yang dikenal agar Midtrans tidak mengulang terus; error dicatat di log
  if (!r.ok) console.error('midtrans notif', n.order_id, r.error);
  return NextResponse.json({ ok: true });
}
