import { NextResponse } from 'next/server';
import { verifyDokuNotification } from '@/lib/doku';
import { applyDoku } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyDokuNotification(request.headers, raw)) return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  let n: any; try { n = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const r = await applyDoku(n);
  if (!r.ok) console.error('doku notif', n?.order?.invoice_number, r.error);
  return NextResponse.json({ ok: true });
}
