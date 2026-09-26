import 'server-only';
import { createHash } from 'crypto';

const prod = () => process.env.MIDTRANS_IS_PRODUCTION === 'true';
const snapBase = () => (prod() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com');
const apiBase = () => (prod() ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com');
const auth = () => 'Basic ' + Buffer.from((process.env.MIDTRANS_SERVER_KEY || '') + ':').toString('base64');

export async function createSnap(p: { orderId: string; amount: number; name: string; email: string; phone: string; item: string; minutes: number }) {
  const res = await fetch(`${snapBase()}/snap/v1/transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: auth() },
    body: JSON.stringify({
      transaction_details: { order_id: p.orderId, gross_amount: p.amount },
      item_details: [{ id: p.orderId, price: p.amount, quantity: 1, name: p.item.slice(0, 50) }],
      customer_details: { first_name: p.name.slice(0, 50), email: p.email, phone: p.phone },
      expiry: { unit: 'minute', duration: Math.max(15, p.minutes) },
      callbacks: { finish: `${process.env.NEXT_PUBLIC_SITE_URL}/akun` },
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) throw new Error(data?.error_messages?.join(', ') || 'Gagal membuat pembayaran');
  return data.token as string;
}

export async function getStatus(orderId: string) {
  const res = await fetch(`${apiBase()}/v2/${encodeURIComponent(orderId)}/status`, { headers: { Accept: 'application/json', Authorization: auth() }, cache: 'no-store' });
  return res.json();
}

export function validSignature(n: any) {
  const expected = createHash('sha512').update(`${n.order_id}${n.status_code}${n.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`).digest('hex');
  return typeof n.signature_key === 'string' && n.signature_key === expected;
}
