'use server';
import { appByToken, checkoutForApp, refreshApp, checkoutForGroup, refreshGroup } from '@/lib/paylink';

const site = () => process.env.NEXT_PUBLIC_SITE_URL || '';

export async function payApp(token: string) {
  const a = await appByToken(token);
  if (!a) return { ok: false, error: 'Link pembayaran tidak valid.' };
  return checkoutForApp(a.id, `${site()}/bayar/${token}?selesai=1`);
}
export async function checkApp(token: string) {
  const a = await appByToken(token);
  if (!a) return { ok: false };
  return { ok: true, status: await refreshApp(a.id) };
}
export async function payGroup(token: string) {
  return checkoutForGroup(token, `${site()}/bayar/kolektif/${token}?selesai=1`);
}
export async function checkGroup(token: string) {
  return { ok: true, status: await refreshGroup(token) };
}

export async function proofUrl(kind: 'app' | 'group', token: string, mime: string, size: number) {
  const { proofUploadUrl } = await import('@/lib/paylink');
  return proofUploadUrl(kind, token, mime, size);
}
export async function sendProof(kind: 'app' | 'group', token: string, d: { path: string; name: string; mime: string; size: number; sender_name: string; sender_bank: string; transfer_date: string }) {
  const { recordProof } = await import('@/lib/paylink');
  return recordProof(kind, token, d);
}
