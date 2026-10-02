import 'server-only';
import { createHash, createHmac, randomUUID } from 'crypto';

const prod = () => process.env.DOKU_IS_PRODUCTION === 'true';
const base = () => (prod() ? 'https://api.doku.com' : 'https://api-sandbox.doku.com');
/** Path Notification URL. HARUS sama dengan path yang diisi di DOKU Back Office (aturan override DOKU). */
export const DOKU_NOTIF_PATH = process.env.DOKU_NOTIF_PATH || '/api/doku/notification';

const digestOf = (body: string) => createHash('sha256').update(body, 'utf8').digest('base64');

/** Signature DOKU (non-SNAP): HMACSHA256=base64(HMAC_SHA256(secret, komponen)) */
export function dokuSignature(p: { clientId: string; requestId: string; timestamp: string; target: string; body?: string }) {
  let comp = `Client-Id:${p.clientId}\nRequest-Id:${p.requestId}\nRequest-Timestamp:${p.timestamp}\nRequest-Target:${p.target}`;
  if (p.body) comp += `\nDigest:${digestOf(p.body)}`;
  return 'HMACSHA256=' + createHmac('sha256', process.env.DOKU_SECRET_KEY || '').update(comp).digest('base64');
}

function headers(target: string, body?: string) {
  const clientId = process.env.DOKU_CLIENT_ID || '';
  const requestId = randomUUID();
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return {
    'Content-Type': 'application/json', 'Client-Id': clientId, 'Request-Id': requestId, 'Request-Timestamp': timestamp,
    Signature: dokuSignature({ clientId, requestId, timestamp, target, body }),
  };
}

export const dokuReady = () => !!process.env.DOKU_CLIENT_ID && !!process.env.DOKU_SECRET_KEY;

/** Buat halaman pembayaran DOKU Checkout → kembalikan URL pembayaran */
export async function createDokuCheckout(p: { invoice: string; amount: number; name: string; email: string; phone: string; item: string; minutes: number; callbackUrl: string }) {
  const target = '/checkout/v1/payment';
  const body = JSON.stringify({
    order: {
      amount: p.amount, invoice_number: p.invoice, currency: 'IDR', callback_url: p.callbackUrl,
      line_items: [{ name: p.item.slice(0, 64), price: p.amount, quantity: 1 }],
    },
    payment: { payment_due_date: Math.max(30, p.minutes) },
    customer: { name: p.name.slice(0, 64), email: p.email, phone: (p.phone || '').replace(/[^\d+]/g, '') },
    // notifikasi transaksi platform ini dikirim ke domain training (path sama dengan yang di Back Office)
    additional_info: { override_notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}${DOKU_NOTIF_PATH}` },
  });
  const res = await fetch(base() + target, { method: 'POST', headers: headers(target, body), body });
  const data: any = await res.json().catch(() => ({}));
  const url = data?.response?.payment?.url;
  if (!res.ok || !url) throw new Error(data?.error?.message || data?.message?.[0] || `DOKU menolak permintaan (${res.status})`);
  return url as string;
}

/** Cek status transaksi ke DOKU */
export async function getDokuStatus(invoice: string) {
  const target = `/orders/v1/status/${invoice}`;
  const res = await fetch(base() + target, { headers: headers(target), cache: 'no-store' });
  return res.json().catch(() => null);
}

/** Verifikasi notifikasi dari DOKU (Request-Target = path Notification URL kita) */
export function verifyDokuNotification(h: Headers, rawBody: string) {
  const sig = h.get('signature') || '';
  const expected = dokuSignature({
    clientId: h.get('client-id') || '', requestId: h.get('request-id') || '', timestamp: h.get('request-timestamp') || '',
    target: DOKU_NOTIF_PATH, body: rawBody,
  });
  return sig.length > 0 && sig === expected && h.get('client-id') === process.env.DOKU_CLIENT_ID;
}

/** Status DOKU → status yang dipahami fungsi database */
export function mapDokuStatus(s?: string): string | null {
  switch ((s || '').toUpperCase()) {
    case 'SUCCESS': return 'settlement';
    case 'EXPIRED': return 'expire';
    case 'PENDING': return 'pending';
    default: return null;   // FAILED diabaikan (Checkout: peserta masih bisa coba metode lain)
  }
}
