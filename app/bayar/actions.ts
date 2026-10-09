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
