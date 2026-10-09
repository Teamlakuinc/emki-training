'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSecret } from '@/lib/crypto';
import { createSnap, getStatus } from '@/lib/midtrans';
import { applyMidtrans, applyDoku } from '@/lib/payments';
import { createDokuCheckout, getDokuStatus, dokuReady } from '@/lib/doku';
import { sendAppEmail, readyToPayKey } from '@/lib/email';
import { refCoordinatorId, claimFromCookie } from '@/lib/ref';

type Res = { ok: boolean; error?: string };
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : v) || null;
const niceErr = (m?: string) => (m || 'Terjadi kesalahan. Coba lagi.').replace(/^.*?ERROR:\s*/, '');

async function me() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/masuk');
  return { supabase, user };
}

export async function startApplication(slug: string, formData?: FormData) {
  const { supabase, user } = await me();
  const sessionId = (formData?.get('session_id') as string) || null;
  const { data: scheme } = await supabase.from('schemes').select('id').eq('slug', slug).eq('is_active', true).single();
  if (!scheme) redirect('/?skema=tidak-ditemukan');
  // sesi yang dipilih harus memang tersedia untuk skema ini
  let validSession: string | null = null;
  if (sessionId) {
    const { data: av } = await supabase.rpc('available_sessions', { p_scheme_slug: slug });
    if ((av || []).some((x: any) => x.session_id === sessionId && x.seats_left > 0)) validSession = sessionId;
  }
  const { data: existing } = await supabase.from('applications').select('id,status')
    .eq('user_id', user.id).eq('scheme_id', scheme.id)
    .in('status', ['draft', 'submitted', 'revision_required', 'recommended', 'awaiting_payment']).maybeSingle();
  if (existing) {
    if (validSession && existing.status === 'draft') await supabase.from('applications').update({ session_id: validSession }).eq('id', existing.id);
    redirect(`/akun/pendaftaran/${existing.id}${validSession ? '?langkah=2' : ''}`);
  }
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  const coordinator_id = await refCoordinatorId();
  const { data: created, error } = await supabase.from('applications')
    .insert({ user_id: user.id, scheme_id: scheme.id, full_name: profile?.full_name || null, email: user.email, coordinator_id, session_id: validSession })
    .select('id').single();
  if (error || !created) redirect('/akun?error=buat');
  redirect(`/akun/pendaftaran/${created.id}${validSession ? '?langkah=2' : ''}`);
}

export async function saveSession(id: string, sessionId: string): Promise<Res> {
  const { supabase } = await me();
  const { error } = await supabase.from('applications').update({ session_id: sessionId }).eq('id', id);
  revalidatePath(`/akun/pendaftaran/${id}`);
  return error ? { ok: false, error: niceErr(error.message) } : { ok: true };
}

export async function savePersonal(id: string, d: Record<string, string>, extra: Record<string, string> = {}): Promise<Res> {
  const { supabase } = await me();
  const nik = (d.nik || '').replace(/\D/g, '');
  if (nik && nik.length !== 16) return { ok: false, error: 'NIK harus 16 digit angka.' };
  const exp = d.experience_years === '' || d.experience_years == null ? null : Number(String(d.experience_years).replace(',', '.'));
  if (exp !== null && (isNaN(exp) || exp < 0 || exp > 60)) return { ok: false, error: 'Lama pengalaman kerja tidak valid.' };
  const payload = {
    full_name: clean(d.full_name), nik: nik || null, birth_place: clean(d.birth_place), birth_date: clean(d.birth_date),
    gender: d.gender === 'L' || d.gender === 'P' ? d.gender : null, address_ktp: clean(d.address_ktp), city: clean(d.city),
    province: clean(d.province), phone: clean(d.phone), email: clean(d.email), education: clean(d.education),
    occupation: clean(d.occupation), workplace: clean(d.workplace), experience_years: exp,
    extra_answers: Object.fromEntries(Object.entries(extra || {}).filter(([k]) => /^[a-z0-9_]{1,60}$/.test(k)).map(([k, v]) => [k, String(v ?? '').slice(0, 1000)])),
  };
  const { error } = await supabase.from('applications').update(payload).eq('id', id);
  revalidatePath(`/akun/pendaftaran/${id}`);
  return error ? { ok: false, error: niceErr(error.message) } : { ok: true };
}

export async function saveSiapkerja(id: string, d: { email: string; phone: string; password?: string }): Promise<Res> {
  const { supabase, user } = await me();
  const { error } = await supabase.from('applications')
    .update({ siapkerja_email: clean(d.email), siapkerja_phone: clean(d.phone) }).eq('id', id);
  if (error) return { ok: false, error: niceErr(error.message) };
  if (d.password) {
    if (d.password.length > 200) return { ok: false, error: 'Password terlalu panjang.' };
    const admin = createAdminClient();   // hanya server; fungsi DB memastikan pendaftaran milik user ini
    const { error: e2 } = await admin.rpc('set_siapkerja_secret', {
      p_application: id, p_user: user.id, p_ciphertext: encryptSecret(d.password),
    });
    if (e2) return { ok: false, error: niceErr(e2.message) };
  }
  revalidatePath(`/akun/pendaftaran/${id}`);
  return { ok: true };
}

export async function recordDocument(id: string, doc: { type: string; path: string; name: string; mime: string; size: number }): Promise<Res> {
  const { supabase, user } = await me();
  if (!doc.path.startsWith(`${user.id}/${id}/`)) return { ok: false, error: 'Lokasi file tidak valid.' };
  const { error } = await supabase.from('application_documents').insert({
    application_id: id, doc_type: doc.type, storage_path: doc.path, file_name: doc.name.slice(0, 200),
    mime_type: doc.mime, size_bytes: doc.size,
  });
  revalidatePath(`/akun/pendaftaran/${id}`);
  return error ? { ok: false, error: niceErr(error.message) } : { ok: true };
}

export async function getDocUrl(path: string): Promise<string | null> {
  const { supabase } = await me();
  const { data } = await supabase.storage.from('application-documents').createSignedUrl(path, 300);
  return data?.signedUrl || null;
}

export async function saveConsent(id: string, agree: boolean): Promise<Res> {
  const { supabase } = await me();
  const { error } = await supabase.from('applications').update({ consent_at: agree ? new Date().toISOString() : null }).eq('id', id);
  return error ? { ok: false, error: niceErr(error.message) } : { ok: true };
}

export async function submitApplication(id: string): Promise<Res> {
  const { supabase } = await me();
  const { data, error } = await supabase.rpc('submit_application', { p_id: id });
  revalidatePath(`/akun/pendaftaran/${id}`); revalidatePath('/akun');
  if (error) return { ok: false, error: niceErr(error.message) };
  await sendAppEmail(id, (data as any)?.status === 'awaiting_payment' ? await readyToPayKey() : 'email_terkirim');
  return { ok: true };
}

export async function acceptRecommendation(id: string, sessionId?: string): Promise<Res> {
  const { supabase } = await me();
  const { error } = await supabase.rpc('accept_recommendation', { p_id: id, p_session_id: sessionId || null });
  revalidatePath(`/akun/pendaftaran/${id}`);
  return error ? { ok: false, error: niceErr(error.message) } : { ok: true };
}

export async function cancelApplication(id: string): Promise<Res> {
  const { supabase } = await me();
  const { error } = await supabase.rpc('cancel_application', { p_id: id });
  revalidatePath(`/akun/pendaftaran/${id}`); revalidatePath('/akun');
  return error ? { ok: false, error: niceErr(error.message) } : { ok: true };
}

/* ---------- pembayaran ---------- */

export async function createPayment(id: string): Promise<Res & { token?: string }> {
  const { supabase, user } = await me();
  const { data: a } = await supabase.from('applications')
    .select('id,user_id,reg_code,status,amount,payment_due_at,full_name,email,phone,schemes!applications_scheme_id_fkey(name)').eq('id', id).maybeSingle();
  if (!a || a.user_id !== user.id) return { ok: false, error: 'Pendaftaran tidak ditemukan.' };
  if (a.status !== 'awaiting_payment') return { ok: false, error: 'Pendaftaran ini tidak sedang menunggu pembayaran.' };
  const minutes = Math.floor((new Date(a.payment_due_at).getTime() - Date.now()) / 60000);
  if (minutes < 5) return { ok: false, error: 'Batas pembayaran sudah lewat. Hubungi admin untuk dibuka kembali.' };
  const db = createAdminClient();
  const { data: prev } = await db.from('payments').select('order_id,snap_token,status,amount,created_at').eq('application_id', id).order('created_at', { ascending: false });
  const reuse = (prev || []).find((p: any) => p.status === 'pending' && p.snap_token && Number(p.amount) === Number(a.amount)
    && Date.now() - new Date(p.created_at).getTime() < 20 * 60 * 60 * 1000);
  if (reuse) return { ok: true, token: reuse.snap_token };
  const orderId = `${a.reg_code}-P${(prev?.length || 0) + 1}`;
  try {
    const token = await createSnap({ orderId, amount: Number(a.amount), name: a.full_name || 'Peserta', email: a.email || user.email!,
      phone: a.phone || '', item: `Sertifikasi BNSP ${(a as any).schemes?.name || ''}`, minutes });
    const { error } = await db.from('payments').insert({ application_id: id, order_id: orderId, amount: a.amount, status: 'pending', snap_token: token, expires_at: a.payment_due_at });
    if (error) return { ok: false, error: error.message };
    return { ok: true, token };
  } catch (e: any) { return { ok: false, error: 'Gagal membuka pembayaran: ' + e.message }; }
}

/** Cek status ke Midtrans (cadangan jika notifikasi terlambat). */
export async function checkPayment(id: string): Promise<Res & { status?: string }> {
  const { supabase, user } = await me();
  const { data: a } = await supabase.from('applications').select('id,user_id').eq('id', id).maybeSingle();
  if (!a || a.user_id !== user.id) return { ok: false, error: 'Pendaftaran tidak ditemukan.' };
  const { data: pays } = await createAdminClient().from('payments').select('order_id').eq('application_id', id).order('created_at', { ascending: false }).limit(3);
  let last: string | undefined;
  for (const p of pays || []) {
    if (/-D\d+$/.test(p.order_id)) {
      const s = await getDokuStatus(p.order_id);
      if (s?.transaction?.status) { const r = await applyDoku(s); last = (r as any).status as string; if (last === 'paid') break; }
    } else {
      const s = await getStatus(p.order_id);
      if (s?.transaction_status) { const r = await applyMidtrans(s); last = r.status as string; if (last === 'paid') break; }
    }
  }
  revalidatePath(`/akun/pendaftaran/${id}`);
  return { ok: true, status: last };
}

/* ---------- transfer manual: kirim bukti ---------- */
export async function submitProof(id: string, d: { path: string; name: string; mime: string; size: number; sender_name: string; sender_bank: string; transfer_date: string }): Promise<Res> {
  const { supabase } = await me();
  const { error } = await supabase.rpc('submit_payment_proof', {
    p_application: id, p_path: d.path, p_file_name: d.name, p_mime: d.mime, p_size: d.size,
    p_sender_name: d.sender_name, p_sender_bank: d.sender_bank, p_transfer_date: d.transfer_date,
  });
  revalidatePath(`/akun/pendaftaran/${id}`); revalidatePath('/akun');
  if (error) return { ok: false, error: niceErr(error.message) };
  await sendAppEmail(id, 'email_bukti_diterima');
  return { ok: true };
}

/* ---------- kode referral manual ---------- */
export async function applyReferral(id: string, code: string): Promise<Res> {
  const { supabase } = await me();
  const c = (code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (c.length < 2) return { ok: false, error: 'Masukkan kode referral.' };
  const { data, error } = await supabase.rpc('claim_referral', { p_code: c });
  if (error) return { ok: false, error: niceErr(error.message) };
  if (!data) return { ok: false, error: 'Kode referral tidak ditemukan atau tidak aktif.' };
  revalidatePath(`/akun/pendaftaran/${id}`);
  return { ok: true };
}

/* ---------- DOKU Checkout ---------- */
export async function createDokuPayment(id: string): Promise<Res & { url?: string }> {
  const { supabase, user } = await me();
  if (!dokuReady()) return { ok: false, error: 'Pembayaran online belum aktif. Hubungi admin.' };
  const { data: a } = await supabase.from('applications')
    .select('id,user_id,reg_code,status,amount,payment_due_at,full_name,email,phone,schemes!applications_scheme_id_fkey(name)').eq('id', id).maybeSingle();
  if (!a || a.user_id !== user.id) return { ok: false, error: 'Pendaftaran tidak ditemukan.' };
  if (a.status !== 'awaiting_payment') return { ok: false, error: 'Pendaftaran ini tidak sedang menunggu pembayaran.' };
  const minutes = Math.floor((new Date(a.payment_due_at).getTime() - Date.now()) / 60000);
  if (minutes < 10) return { ok: false, error: 'Batas pembayaran sudah lewat. Hubungi admin untuk dibuka kembali.' };
  const db = createAdminClient();
  const { data: prev } = await db.from('payments').select('order_id,snap_token,status,amount,created_at').eq('application_id', id).order('created_at', { ascending: false });
  const reuse = (prev || []).find((p: any) => p.status === 'pending' && p.snap_token?.startsWith('http') && Number(p.amount) === Number(a.amount)
    && Date.now() - new Date(p.created_at).getTime() < 6 * 60 * 60 * 1000);
  if (reuse) return { ok: true, url: reuse.snap_token };
  const invoice = `${a.reg_code}-D${(prev?.length || 0) + 1}`;
  try {
    const url = await createDokuCheckout({ invoice, amount: Number(a.amount), name: a.full_name || 'Peserta', email: a.email || user.email!,
      phone: a.phone || '', item: `Sertifikasi BNSP ${(a as any).schemes?.name || ''}`, minutes,
      callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/akun/pendaftaran/${id}?bayar=1` });
    const { error } = await db.from('payments').insert({ application_id: id, order_id: invoice, amount: a.amount, status: 'pending', snap_token: url, expires_at: a.payment_due_at, payment_type: 'doku' });
    if (error) return { ok: false, error: error.message };
    return { ok: true, url };
  } catch (e: any) { return { ok: false, error: 'Gagal membuka pembayaran: ' + e.message }; }
}

/** Peserta memperbaiki akun SIAPkerja setelah diminta admin (berlaku di status apa pun). */
export async function fixSiapkerja(id: string, d: { email: string; phone: string; password: string }): Promise<Res> {
  const { supabase, user } = await me();
  const { data: a } = await supabase.from('applications').select('id,user_id,siapkerja_fix_requested_at').eq('id', id).maybeSingle();
  if (!a || a.user_id !== user.id) return { ok: false, error: 'Pendaftaran tidak ditemukan.' };
  if (!a.siapkerja_fix_requested_at) return { ok: false, error: 'Tidak ada permintaan perbaikan SIAPkerja untuk pendaftaran ini.' };
  const email = clean(d.email) as string | null, phone = clean(d.phone) as string | null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Email SIAPkerja tidak valid.' };
  if (!phone || phone.replace(/\D/g, '').length < 9) return { ok: false, error: 'No. telepon SIAPkerja tidak valid.' };
  if (!d.password) return { ok: false, error: 'Isi password SIAPkerja yang benar.' };
  if (d.password.length > 200) return { ok: false, error: 'Password terlalu panjang.' };
  const admin = createAdminClient();
  const { error: e1 } = await admin.rpc('set_siapkerja_secret', { p_application: id, p_user: user.id, p_ciphertext: encryptSecret(d.password) });
  if (e1) return { ok: false, error: niceErr(e1.message) };
  const { error: e2 } = await admin.from('applications').update({
    siapkerja_email: email, siapkerja_phone: phone, siapkerja_fix_requested_at: null, siapkerja_fixed_at: new Date().toISOString(),
  }).eq('id', id).eq('user_id', user.id);
  if (e2) return { ok: false, error: niceErr(e2.message) };
  revalidatePath(`/akun/pendaftaran/${id}`); revalidatePath(`/admin/pendaftar/${id}`);
  return { ok: true };
}
