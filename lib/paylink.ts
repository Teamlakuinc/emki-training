import 'server-only';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createDokuCheckout, getDokuStatus, mapDokuStatus, dokuReady } from '@/lib/doku';
import { applyDoku } from '@/lib/payments';
import { sendAppEmail } from '@/lib/email';

// huruf kecil + angka saja: aman walau link diketik ulang / diubah huruf kecil oleh aplikasi chat
export const newToken = () => randomBytes(15).toString('hex');
const site = () => process.env.NEXT_PUBLIC_SITE_URL || '';
const SIX_H = 6 * 60 * 60 * 1000;
const minutesLeft = (iso?: string | null) => (iso ? Math.floor((new Date(iso).getTime() - Date.now()) / 60000) : 0);

/* ===================== PER PESERTA ===================== */
export async function appByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token || '')) return null;
  token = token.toLowerCase();
  const db = createAdminClient();
  const { data, error } = await db.from('applications')
    .select('id,reg_code,full_name,email,phone,status,amount,payment_due_at,paid_at,schemes!applications_scheme_id_fkey(name),exam_sessions(name,start_time,end_time,exam_schedules(exam_date,tuk))')
    .eq('pay_token', token).maybeSingle();
  if (error) console.error('appByToken', error.message);
  return data;
}

/** Buat / pakai ulang halaman pembayaran DOKU untuk satu pendaftaran (tanpa login). */
export async function checkoutForApp(appId: string, callbackUrl: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!dokuReady()) return { ok: false, error: 'Pembayaran online belum aktif. Hubungi admin.' };
  const db = createAdminClient();
  const { data: a } = await db.from('applications')
    .select('id,reg_code,status,amount,payment_due_at,full_name,email,phone,schemes!applications_scheme_id_fkey(name)').eq('id', appId).maybeSingle();
  if (!a) return { ok: false, error: 'Pendaftaran tidak ditemukan.' };
  if (a.status === 'paid') return { ok: false, error: 'Pendaftaran ini sudah lunas.' };
  if (a.status !== 'awaiting_payment') return { ok: false, error: 'Pendaftaran ini tidak sedang menunggu pembayaran.' };
  const minutes = minutesLeft(a.payment_due_at);
  if (minutes < 10) return { ok: false, error: 'Batas pembayaran sudah lewat. Hubungi admin untuk dibuka kembali.' };
  const { data: prev } = await db.from('payments').select('order_id,snap_token,status,amount,created_at,expires_at').eq('application_id', appId).order('created_at', { ascending: false });
  // pakai ulang halaman DOKU lama hanya kalau batas waktunya masih sama (belum diperpanjang/diubah) dan belum lewat
  const reuse = (prev || []).find((p: any) => p.status === 'pending' && p.snap_token?.startsWith('http') && Number(p.amount) === Number(a.amount)
    && Date.now() - new Date(p.created_at).getTime() < SIX_H && p.expires_at && a.payment_due_at
    && new Date(p.expires_at).getTime() === new Date(a.payment_due_at).getTime() && new Date(p.expires_at).getTime() > Date.now() + 5 * 60000);
  if (reuse) return { ok: true, url: reuse.snap_token };
  const invoice = `${a.reg_code}-D${(prev?.length || 0) + 1}`;
  try {
    const url = await createDokuCheckout({ invoice, amount: Number(a.amount), name: a.full_name || 'Peserta', email: a.email || process.env.SMTP_USER || 'hi@edukasikuliner.com',
      phone: a.phone || '', item: `Sertifikasi BNSP ${(a as any).schemes?.name || ''}`, minutes, callbackUrl });
    const { error } = await db.from('payments').insert({ application_id: appId, order_id: invoice, amount: a.amount, status: 'pending', snap_token: url, expires_at: a.payment_due_at, payment_type: 'doku' });
    if (error) return { ok: false, error: error.message };
    return { ok: true, url };
  } catch (e: any) { return { ok: false, error: 'Gagal membuka pembayaran: ' + e.message }; }
}

/** Cek ulang status pembayaran DOKU satu pendaftaran. */
export async function refreshApp(appId: string) {
  const db = createAdminClient();
  const { data: pays } = await db.from('payments').select('order_id,status').eq('application_id', appId).eq('status', 'pending');
  for (const p of pays || []) {
    if (!/-D\d+$/.test(p.order_id)) continue;
    const s = await getDokuStatus(p.order_id);
    if (s?.transaction?.status) { const r: any = await applyDoku(s); if (r?.status === 'paid') return 'paid'; }
  }
  return null;
}

/* ===================== KOLEKTIF ===================== */
export async function groupByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token || '')) return null;
  token = token.toLowerCase();
  const db = createAdminClient();
  const { data: g, error } = await db.from('group_invoices').select('*').eq('token', token).maybeSingle();
  if (error) console.error('groupByToken', error.message);
  if (!g) return null;
  const { data: items } = await db.from('group_invoice_items')
    .select('application_id, applications(id,reg_code,full_name,status,amount,payment_due_at,schemes!applications_scheme_id_fkey(name),exam_sessions(name,exam_schedules(exam_date,tuk)))')
    .eq('invoice_id', g.id);
  const apps = (items || []).map((x: any) => x.applications).filter(Boolean)
    .sort((x: any, y: any) => String(x.full_name).localeCompare(String(y.full_name)));
  return { g, apps };
}

/** Peserta di tagihan kolektif yang masih bisa dibayar sekarang. */
export const payable = (apps: any[]) => apps.filter(a => a.status === 'awaiting_payment' && a.amount > 0 && minutesLeft(a.payment_due_at) >= 10);

export async function checkoutForGroup(token: string, callbackUrl: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!dokuReady()) return { ok: false, error: 'Pembayaran online belum aktif. Hubungi admin.' };
  const data = await groupByToken(token);
  if (!data) return { ok: false, error: 'Tagihan tidak ditemukan.' };
  const list = payable(data.apps);
  if (!list.length) return { ok: false, error: 'Tidak ada peserta yang perlu dibayar di tagihan ini (sudah lunas atau batas bayar lewat).' };
  const total = list.reduce((s, a) => s + Number(a.amount), 0);
  const ids = list.map(a => a.id).sort();
  const db = createAdminClient();
  const { data: prev } = await db.from('group_payments').select('order_id,snap_token,status,amount,app_ids,created_at').eq('invoice_id', data.g.id).order('created_at', { ascending: false });
  const same = (x: string[]) => [...x].sort().join() === ids.join();
  const reuse = (prev || []).find((p: any) => p.status === 'pending' && Number(p.amount) === total && same(p.app_ids) && Date.now() - new Date(p.created_at).getTime() < 25 * 60000);
  if (reuse) return { ok: true, url: reuse.snap_token };
  const minutes = Math.min(...list.map(a => minutesLeft(a.payment_due_at)));
  const invoice = `${data.g.code}-D${(prev?.length || 0) + 1}`;
  try {
    const url = await createDokuCheckout({
      invoice, amount: total, name: data.g.payer_name || 'Pembayar kolektif', email: data.g.payer_email || process.env.SMTP_USER || 'hi@edukasikuliner.com',
      phone: data.g.payer_phone || '', item: `Sertifikasi BNSP ${list.length} peserta (${data.g.code})`, minutes, callbackUrl,
    });
    const { error } = await db.from('group_payments').insert({ invoice_id: data.g.id, order_id: invoice, amount: total, app_ids: list.map(a => a.id), amounts: list.map(a => Number(a.amount)), status: 'pending', snap_token: url });
    if (error) return { ok: false, error: error.message };
    return { ok: true, url };
  } catch (e: any) { return { ok: false, error: 'Gagal membuka pembayaran: ' + e.message }; }
}

/** Terapkan notifikasi / status DOKU untuk tagihan kolektif. */
export async function applyGroupDoku(n: any) {
  const invoice = n?.order?.invoice_number;
  const st = mapDokuStatus(n?.transaction?.status);
  if (!invoice || !st) return { ok: true, status: null };
  const db = createAdminClient();
  const { data: before } = await db.from('group_payments').select('status,app_ids').eq('order_id', invoice).maybeSingle();
  if (!before) return { ok: false, error: 'order kolektif tidak dikenal' };
  const { data: res, error } = await db.rpc('apply_group_payment', {
    p_order_id: invoice, p_transaction_status: st, p_gross_amount: n?.order?.amount != null ? Number(n.order.amount) : null, p_raw: n,
  });
  if (error) return { ok: false, error: error.message };
  if (res === 'paid' && before.status !== 'paid') for (const id of before.app_ids || []) await sendAppEmail(id, 'email_lunas');
  return { ok: true, status: res };
}

export async function refreshGroup(token: string) {
  const data = await groupByToken(token);
  if (!data) return null;
  const db = createAdminClient();
  const { data: pays } = await db.from('group_payments').select('order_id').eq('invoice_id', data.g.id).eq('status', 'pending');
  for (const p of pays || []) {
    const s = await getDokuStatus(p.order_id);
    if (s?.transaction?.status) { const r: any = await applyGroupDoku(s); if (r?.status === 'paid') return 'paid'; }
  }
  return null;
}
