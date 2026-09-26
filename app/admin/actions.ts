'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';
import { decryptSecret } from '@/lib/crypto';
import { headers } from 'next/headers';
import { sendAppEmail } from '@/lib/email';

type Res = { ok: boolean; error?: string; data?: any };
const err = (m?: string) => ({ ok: false, error: (m || 'Terjadi kesalahan.').replace(/^.*?ERROR:\s*/, '') });

/* ---------- verifikasi ---------- */
export async function decide(id: string, decision: string, note: string, recommended?: string): Promise<Res> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc('verifier_decide', {
    p_id: id, p_decision: decision, p_note: note || null, p_recommended_scheme: recommended || null,
  });
  revalidatePath(`/admin/pendaftar/${id}`); revalidatePath('/admin');
  if (error) return err(error.message);
  const key = { approve: 'email_siap_bayar', revision: 'email_revisi', recommend: 'email_rekomendasi', reject: 'email_ditolak' }[decision];
  if (key) await sendAppEmail(id, key);
  return { ok: true };
}

/* ---------- admin: pindah sesi, perpanjang, catatan, hasil ---------- */
export async function moveSession(id: string, sessionId: string, force: boolean): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { error } = await supabase.rpc('admin_move_session', { p_id: id, p_session_id: sessionId, p_force: force });
  revalidatePath(`/admin/pendaftar/${id}`);
  return error ? err(error.message) : { ok: true };
}
export async function extendPayment(id: string, hours: number): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { error } = await supabase.rpc('admin_extend_payment', { p_id: id, p_hours: hours });
  revalidatePath(`/admin/pendaftar/${id}`);
  return error ? err(error.message) : { ok: true };
}
export async function saveAdminNotes(id: string, notes: string, result: string): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { error } = await supabase.from('applications')
    .update({ admin_notes: notes || null, exam_result: result || null }).eq('id', id);
  revalidatePath(`/admin/pendaftar/${id}`);
  return error ? err(error.message) : { ok: true };
}

/* ---------- password SIAPkerja (admin, tercatat) ---------- */
export async function revealSecret(id: string, reason: string): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  if (!reason || reason.trim().length < 5) return err('Tuliskan alasan singkat (minimal 5 karakter).');
  const ip = headers().get('x-real-ip') || headers().get('x-forwarded-for') || null;
  const { data, error } = await supabase.rpc('admin_reveal_secret', { p_application: id, p_reason: reason.trim(), p_ip: ip });
  if (error) return err(error.message);
  try { return { ok: true, data: decryptSecret(data as string) }; }
  catch { return err('Password tidak dapat dibuka (kunci enkripsi berbeda).'); }
}

/* ---------- log notifikasi WA ---------- */
export async function logNotification(id: string, key: string): Promise<Res> {
  const { supabase, user } = await requireStaff();
  await supabase.from('notification_logs').insert({ application_id: id, channel: 'whatsapp', template_key: key, sent_by: user.id });
  return { ok: true };
}

/* ---------- jadwal & sesi ---------- */
export async function saveSchedule(f: FormData): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const id = f.get('id') as string | null;
  const payload: any = {
    title: String(f.get('title') || '').trim(), exam_date: f.get('exam_date'), tuk: String(f.get('tuk') || '').trim(),
    address: String(f.get('address') || '').trim() || null, asesor: String(f.get('asesor') || '').trim() || null,
    registration_deadline: f.get('registration_deadline') || null, status: f.get('status') || 'draft',
    notes: String(f.get('notes') || '').trim() || null,
  };
  if (!payload.title || !payload.exam_date || !payload.tuk) return err('Judul, tanggal, dan TUK wajib diisi.');
  const schemes = f.getAll('schemes') as string[];
  let sid = id;
  if (id) {
    const { error } = await supabase.from('exam_schedules').update(payload).eq('id', id);
    if (error) return err(error.message);
  } else {
    const { data, error } = await supabase.from('exam_schedules').insert(payload).select('id').single();
    if (error) return err(error.message);
    sid = data.id;
  }
  // harga khusus per skema untuk jadwal ini (kosong = harga dasar skema)
  const priceRows = Array.from(f.entries()).filter(([k, v]) => k.startsWith('price_') && String(v).replace(/\D/g, '') !== '')
    .map(([k, v]) => ({ schedule_id: sid, scheme_id: k.slice(6), price: Number(String(v).replace(/\D/g, '')) }));
  await supabase.from('exam_schedule_prices').delete().eq('schedule_id', sid);
  if (priceRows.length) { const { error } = await supabase.from('exam_schedule_prices').insert(priceRows); if (error) return err(error.message); }
  await supabase.from('exam_schedule_schemes').delete().eq('schedule_id', sid);
  if (schemes.length) {
    const { error } = await supabase.from('exam_schedule_schemes').insert(schemes.map(s => ({ schedule_id: sid, scheme_id: s })));
    if (error) return err(error.message);
  }
  revalidatePath('/admin/jadwal');
  return { ok: true, data: sid };
}

export async function saveSession(f: FormData): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const id = f.get('id') as string | null;
  const payload: any = {
    schedule_id: f.get('schedule_id'), name: String(f.get('name') || '').trim(),
    start_time: f.get('start_time'), end_time: f.get('end_time'), quota: Number(f.get('quota')),
    sort_order: Number(f.get('sort_order') || 0),
  };
  if (!payload.name || !payload.start_time || !payload.end_time || !(payload.quota > 0)) return err('Lengkapi nama sesi, jam, dan kuota.');
  const { error } = id ? await supabase.from('exam_sessions').update(payload).eq('id', id)
                       : await supabase.from('exam_sessions').insert(payload);
  revalidatePath(`/admin/jadwal/${payload.schedule_id}`);
  return error ? err(error.message) : { ok: true };
}

export async function deleteSession(id: string, scheduleId: string): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { error } = await supabase.from('exam_sessions').delete().eq('id', id);
  revalidatePath(`/admin/jadwal/${scheduleId}`);
  return error ? err(error.message.includes('foreign key') ? 'Sesi ini sudah dipilih peserta. Pindahkan peserta dulu atau kurangi kuota saja.' : error.message) : { ok: true };
}

/* ---------- template pesan ---------- */
export async function saveTemplate(f: FormData): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const key = String(f.get('key') || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const payload = {
    key, channel: String(f.get('channel') || 'whatsapp'), title: String(f.get('title') || '').trim(),
    subject: String(f.get('subject') || '').trim() || null, body: String(f.get('body') || ''),
    is_active: f.get('is_active') === 'on', sort_order: Number(f.get('sort_order') || 0),
  };
  if (!key || !payload.title || !payload.body) return err('Kode, judul, dan isi wajib diisi.');
  const { error } = await supabase.from('message_templates').upsert(payload);
  revalidatePath('/admin/template');
  return error ? err(error.message) : { ok: true };
}

/* ---------- tim (super admin) ---------- */
export async function setRole(email: string, role: string): Promise<Res> {
  const { supabase } = await requireStaff('super');
  if (!['admin', 'verifikator', 'participant'].includes(role)) return err('Role tidak valid.');
  const { data, error } = await supabase.from('profiles').update({ role }).eq('email', email.trim().toLowerCase()).select('id');
  if (error) return err(error.message);
  if (!data?.length) return err('Email belum terdaftar. Minta orangnya membuat akun dulu di halaman Buat Akun.');
  revalidatePath('/admin/tim');
  return { ok: true };
}

/* ---------- skema & harga ---------- */
export async function saveScheme(f: FormData): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const id = f.get('id') as string | null;
  const price = Number(String(f.get('price') || '').replace(/\D/g, ''));
  const payload: any = {
    name: String(f.get('name') || '').trim(), export_label: String(f.get('export_label') || '').trim() || null,
    price, requires_verification: f.get('requires_verification') === 'on', is_active: f.get('is_active') === 'on',
    level_order: Number(f.get('level_order') || 0),
  };
  if (!payload.name || !(price >= 0)) return err('Nama dan harga wajib diisi.');
  if (id) {
    const { error } = await supabase.from('schemes').update(payload).eq('id', id);
    if (error) return err(error.message);
  } else {
    const slug = String(f.get('slug') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!slug) return err('Slug wajib diisi (mis. pastry-chef).');
    const { data: g } = await supabase.from('certification_groups').select('id').order('sort_order').limit(1).single();
    const { error } = await supabase.from('schemes').insert({ ...payload, slug, group_id: f.get('group_id') || g?.id });
    if (error) return err(error.message.includes('duplicate') ? 'Slug sudah dipakai skema lain.' : error.message);
  }
  revalidatePath('/admin/skema');
  return { ok: true };
}

/* ---------- dokumen wajib ---------- */
export async function saveRequiredDoc(f: FormData): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const isNew = f.get('is_new') === '1';
  const code = String(f.get('code') || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const schemes = f.getAll('scheme_ids') as string[];
  const payload: any = {
    code, name: String(f.get('name') || '').trim(), description: String(f.get('description') || '').trim() || null,
    accept: String(f.get('accept') || 'image_pdf'), is_required: f.get('is_required') === 'on', is_active: f.get('is_active') === 'on',
    sort_order: Number(f.get('sort_order') || 0), scheme_ids: schemes.length ? schemes : null,
  };
  if (!code || !payload.name) return err('Kode dan nama dokumen wajib diisi.');
  const { error } = isNew ? await supabase.from('required_documents').insert(payload)
                          : await supabase.from('required_documents').update(payload).eq('code', code);
  revalidatePath('/admin/formulir');
  return error ? err(error.message.includes('duplicate') ? 'Kode sudah dipakai.' : error.message) : { ok: true };
}

/* ---------- pertanyaan tambahan ---------- */
export async function saveCustomField(f: FormData): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const isNew = f.get('is_new') === '1';
  const code = String(f.get('code') || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const schemes = f.getAll('scheme_ids') as string[];
  const type = String(f.get('field_type') || 'text');
  const options = String(f.get('options') || '').split('\n').map(x => x.trim()).filter(Boolean);
  const payload: any = {
    code, label: String(f.get('label') || '').trim(), help_text: String(f.get('help_text') || '').trim() || null,
    field_type: type, options: type === 'select' ? options : null, is_required: f.get('is_required') === 'on',
    is_active: f.get('is_active') === 'on', sort_order: Number(f.get('sort_order') || 0), scheme_ids: schemes.length ? schemes : null,
  };
  if (!code || !payload.label) return err('Kode dan pertanyaan wajib diisi.');
  if (type === 'select' && options.length < 2) return err('Isi minimal 2 pilihan jawaban (satu per baris).');
  const { error } = isNew ? await supabase.from('custom_fields').insert(payload)
                          : await supabase.from('custom_fields').update(payload).eq('code', code);
  revalidatePath('/admin/formulir');
  return error ? err(error.message.includes('duplicate') ? 'Kode sudah dipakai.' : error.message) : { ok: true };
}


/* ---------- koordinator ---------- */
export async function saveCoordinator(f: FormData): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const id = f.get('id') as string | null;
  const code = String(f.get('code') || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const payload: any = { code, name: String(f.get('name') || '').trim(), phone: String(f.get('phone') || '').trim() || null,
    notes: String(f.get('notes') || '').trim() || null, is_active: f.get('is_active') === 'on' };
  if (code.length < 2 || !payload.name) return err('Kode (min. 2 huruf/angka) dan nama wajib diisi.');
  let cid = id;
  if (id) { const { error } = await supabase.from('coordinators').update(payload).eq('id', id); if (error) return err(error.message.includes('duplicate') ? 'Kode sudah dipakai.' : error.message); }
  else { const { data, error } = await supabase.from('coordinators').insert(payload).select('id').single(); if (error) return err(error.message.includes('duplicate') ? 'Kode sudah dipakai.' : error.message); cid = data.id; }
  // aturan markup: default (semua skema) + per skema
  const rows: any[] = [];
  const dv = String(f.get('m_default_value') || '').replace(',', '.');
  if (dv !== '') rows.push({ coordinator_id: cid, scheme_id: null, markup_type: f.get('m_default_type') || 'amount', value: Number(dv) });
  for (const [k, v] of Array.from(f.entries())) {
    if (k.startsWith('m_value_') && String(v).trim() !== '') {
      const sid = k.slice(8);
      rows.push({ coordinator_id: cid, scheme_id: sid, markup_type: f.get('m_type_' + sid) || 'amount', value: Number(String(v).replace(',', '.')) });
    }
  }
  if (rows.some(r => isNaN(r.value) || r.value < 0)) return err('Nilai markup tidak valid.');
  await supabase.from('coordinator_markups').delete().eq('coordinator_id', cid);
  if (rows.length) { const { error } = await supabase.from('coordinator_markups').insert(rows); if (error) return err(error.message); }
  revalidatePath('/admin/koordinator');
  return { ok: true, data: cid };
}

/* ---------- email jadwal massal ---------- */
export async function emailSchedule(scheduleId: string): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { data: sess } = await supabase.from('exam_sessions').select('id').eq('schedule_id', scheduleId);
  const ids = (sess || []).map(s => s.id);
  if (!ids.length) return err('Belum ada sesi.');
  const { data: apps } = await supabase.from('applications').select('id').in('session_id', ids).eq('status', 'paid');
  let sent = 0;
  for (const a of apps || []) if (await sendAppEmail(a.id, 'email_jadwal')) sent++;
  return { ok: true, data: `${sent} dari ${(apps || []).length} email terkirim.` };
}
