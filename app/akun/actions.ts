'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSecret } from '@/lib/crypto';

type Res = { ok: boolean; error?: string };
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : v) || null;
const niceErr = (m?: string) => (m || 'Terjadi kesalahan. Coba lagi.').replace(/^.*?ERROR:\s*/, '');

async function me() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/masuk');
  return { supabase, user };
}

export async function startApplication(slug: string) {
  const { supabase, user } = await me();
  const { data: scheme } = await supabase.from('schemes').select('id').eq('slug', slug).eq('is_active', true).single();
  if (!scheme) redirect('/?skema=tidak-ditemukan');
  const { data: existing } = await supabase.from('applications').select('id')
    .eq('user_id', user.id).eq('scheme_id', scheme.id)
    .in('status', ['draft', 'submitted', 'revision_required', 'recommended', 'awaiting_payment']).maybeSingle();
  if (existing) redirect(`/akun/pendaftaran/${existing.id}`);
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  const { data: created, error } = await supabase.from('applications')
    .insert({ user_id: user.id, scheme_id: scheme.id, full_name: profile?.full_name || null, email: user.email })
    .select('id').single();
  if (error || !created) redirect('/akun?error=buat');
  redirect(`/akun/pendaftaran/${created.id}`);
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
  const { error } = await supabase.rpc('submit_application', { p_id: id });
  revalidatePath(`/akun/pendaftaran/${id}`); revalidatePath('/akun');
  return error ? { ok: false, error: niceErr(error.message) } : { ok: true };
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
