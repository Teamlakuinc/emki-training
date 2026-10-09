'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { decryptSecret } from '@/lib/crypto';
import { headers } from 'next/headers';
import { sendAppEmail, readyToPayKey } from '@/lib/email';

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
  const key = { approve: await readyToPayKey(), revision: 'email_revisi', recommend: 'email_rekomendasi', reject: 'email_ditolak' }[decision];
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
  const supabase = createClient();   // wewenang dicek di database (staf atau koordinator peserta ini, wajib 2 langkah)
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
export async function setRole(email: string, role: string, coordinatorId?: string): Promise<Res> {
  const { supabase } = await requireStaff('super');
  if (!['verifikator', 'koordinator', 'participant'].includes(role)) return err('Role tidak valid.');
  const { data: prof } = await supabase.from('profiles').select('id,role').eq('email', email.trim().toLowerCase()).maybeSingle();
  if (!prof) return err('Email belum terdaftar. Minta orangnya membuat akun dulu di halaman Buat Akun.');
  if (prof.role === 'super_admin') return err('Role Super Admin tidak bisa diubah dari sini.');
  if (role === 'koordinator' && !coordinatorId) return err('Pilih data koordinator yang dihubungkan ke akun ini.');
  const { error } = await supabase.from('profiles').update({ role }).eq('id', prof.id);
  if (error) return err(error.message);
  await supabase.from('coordinators').update({ user_id: null }).eq('user_id', prof.id);
  if (role === 'koordinator') {
    const { error: e2 } = await supabase.from('coordinators').update({ user_id: prof.id }).eq('id', coordinatorId);
    if (e2) return err(e2.message);
  }
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
    notes: String(f.get('notes') || '').trim() || null, is_active: f.get('is_active') === 'on',
    flat_commission: Number(String(f.get('flat_commission') ?? '100000').replace(/\D/g, '') || 0) };
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
  if (f.get('apply_unpaid') === 'on') {
    const { data: mm } = await supabase.rpc('admin_price_mismatches');
    for (const m of (mm as any[]) || []) if (m.koordinator === code) await supabase.rpc('admin_reprice', { p_app: m.application_id });
  }
  revalidatePath('/admin/koordinator'); revalidatePath('/admin');
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

/* ---------- markup koordinator: tandai sudah dibayarkan ---------- */
export async function markMarkupPaid(coordinatorId: string): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { data, error } = await supabase.from('applications').update({ markup_paid_at: new Date().toISOString() })
    .eq('coordinator_id', coordinatorId).eq('status', 'paid').is('markup_paid_at', null).gt('commission_amount', 0).select('commission_amount');
  if (error) return err(error.message);
  const total = (data || []).reduce((n: number, r: any) => n + Number(r.commission_amount || 0), 0);
  revalidatePath(`/admin/koordinator/${coordinatorId}`);
  return { ok: true, data: { count: data?.length || 0, total } };
}

/* ---------- urutan sesi berdasarkan skema ---------- */
export async function rebalanceSessions(scheduleId: string, apply: boolean, notify: boolean): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { data, error } = await supabase.rpc('admin_rebalance_sessions', { p_schedule: scheduleId, p_apply: apply });
  if (error) return err(error.message);
  if (apply) {
    if (notify) for (const m of (data as any[]) || []) await sendAppEmail(m.application_id, 'email_pindah_sesi');
    revalidatePath(`/admin/jadwal/${scheduleId}`);
  }
  return { ok: true, data };
}


/* ---------- konfirmasi pembayaran transfer (Super Admin + Verifikator) ---------- */
export async function reviewPayment(proofId: string, approve: boolean, note: string): Promise<Res> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc('review_payment', { p_proof: proofId, p_approve: approve, p_note: note || null });
  if (error) return err(error.message);
  const a: any = data;
  if (approve) await sendAppEmail(a.id, 'email_lunas');
  else await sendAppEmail(a.id, 'email_bukti_ditolak', { catatan: note });
  revalidatePath('/admin/pembayaran'); revalidatePath('/admin');
  return { ok: true };
}

/* ---------- pengaturan pembayaran & rekening (Super Admin) ---------- */
export async function savePaymentMethod(method: string): Promise<Res> {
  const { supabase } = await requireStaff('super');
  if (!['manual', 'midtrans', 'both'].includes(method)) return err('Pilihan tidak valid.');
  const { error } = await supabase.from('app_settings').upsert({ key: 'payment_method', value: method, updated_at: new Date().toISOString() });
  revalidatePath('/admin/pengaturan');
  return error ? err(error.message) : { ok: true };
}
export async function saveBank(f: FormData): Promise<Res> {
  const { supabase } = await requireStaff('super');
  const id = f.get('id') as string | null;
  const payload = { bank: String(f.get('bank') || '').trim(), account_number: String(f.get('account_number') || '').replace(/\s/g, ''),
    account_name: String(f.get('account_name') || '').trim(), is_active: f.get('is_active') === 'on', sort_order: Number(f.get('sort_order') || 0) };
  if (!payload.bank || !payload.account_number || !payload.account_name) return err('Bank, nomor rekening, dan atas nama wajib diisi.');
  const { error } = id ? await supabase.from('bank_accounts').update(payload).eq('id', id) : await supabase.from('bank_accounts').insert(payload);
  revalidatePath('/admin/pengaturan');
  return error ? err(error.message) : { ok: true };
}
export async function deleteBank(id: string): Promise<Res> {
  const { supabase } = await requireStaff('super');
  const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
  revalidatePath('/admin/pengaturan');
  return error ? err(error.message) : { ok: true };
}

/* ---------- dokumen yang diisi tim (mis. screenshot Sisfo) — Super Admin / koordinator pesertanya ---------- */
export async function recordStaffDocument(appId: string, doc: { type: string; path: string; name: string; mime: string; size: number }): Promise<Res> {
  const supabase = createClient();   // wewenang dicek oleh RLS
  if (!doc.path.includes(`/${appId}/tim-`)) return err('Lokasi file tidak valid.');
  const { error } = await supabase.from('application_documents').insert({
    application_id: appId, doc_type: doc.type, storage_path: doc.path, file_name: doc.name.slice(0, 200), mime_type: doc.mime, size_bytes: doc.size });
  revalidatePath(`/admin/pendaftar/${appId}`); revalidatePath(`/koordinator/peserta/${appId}`);
  return error ? err(error.message) : { ok: true };
}

/* ======================= KELOLA PESERTA (Super Admin) ======================= */
async function logChange(supabase: any, userId: string, appId: string, action: string, detail: any) {
  const { data: a } = await supabase.from('applications').select('reg_code,full_name').eq('id', appId).maybeSingle();
  await supabase.from('admin_change_logs').insert({ application_id: appId, reg_code: a?.reg_code, full_name: a?.full_name, actor_id: userId, action, detail });
}
const done = (id: string) => { revalidatePath(`/admin/pendaftar/${id}`); revalidatePath('/admin/pendaftar'); revalidatePath('/admin'); };

export async function adminSetCoordinator(id: string, coordinatorId: string | null, reprice: boolean): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { error } = await supabase.rpc('admin_set_coordinator', { p_app: id, p_coordinator: coordinatorId || null, p_reprice: reprice });
  done(id); return error ? err(error.message) : { ok: true };
}
export async function adminReprice(id: string): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { error } = await supabase.rpc('admin_reprice', { p_app: id });
  done(id); return error ? err(error.message) : { ok: true };
}
export async function adminSetAmount(id: string, amount: number, reason: string): Promise<Res> {
  const { supabase, user } = await requireStaff('admin');
  if (!(amount >= 0)) return err('Nominal tidak valid.');
  if (!reason?.trim()) return err('Tulis alasan perubahan harga.');
  const { data: a } = await supabase.from('applications').select('amount,base_amount').eq('id', id).single();
  const { error } = await supabase.from('applications').update({ amount, commission_amount: null }).eq('id', id);
  if (error) return err(error.message);
  await logChange(supabase, user.id, id, 'ubah_harga_manual', { dari: a?.amount, ke: amount, alasan: reason });
  done(id); return { ok: true };
}
export async function adminSetStatus(id: string, status: string, reason: string): Promise<Res> {
  const { supabase, user } = await requireStaff('admin');
  const allowed = ['draft', 'submitted', 'revision_required', 'awaiting_payment', 'payment_review', 'paid', 'expired', 'rejected', 'cancelled'];
  if (!allowed.includes(status)) return err('Status tidak valid.');
  if (!reason?.trim()) return err('Tulis alasan perubahan status.');
  const { data: a } = await supabase.from('applications').select('status,amount,scheme_id,session_id,coordinator_id,reg_code').eq('id', id).single();
  const patch: any = { status };
  if (status === 'paid') patch.paid_at = new Date().toISOString();
  if (status === 'awaiting_payment') patch.payment_due_at = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  if (status !== 'draft' && a?.amount == null && a?.session_id) {
    const { data: pr } = await supabase.rpc('price_for', { p_scheme: a.scheme_id, p_session: a.session_id, p_coordinator: a.coordinator_id });
    const r: any = Array.isArray(pr) ? pr[0] : pr;
    if (r) Object.assign(patch, { amount: r.total, base_amount: r.base, markup_amount: r.markup });
  }
  const { error } = await supabase.from('applications').update(patch).eq('id', id);
  if (error) return err(error.message);
  await logChange(supabase, user.id, id, 'ubah_status_manual', { dari: a?.status, ke: status, alasan: reason });
  done(id); return { ok: true };
}
export async function adminSetScheme(id: string, schemeId: string, reprice: boolean): Promise<Res> {
  const { supabase, user } = await requireStaff('admin');
  const { data: a } = await supabase.from('applications').select('scheme_id, schemes!applications_scheme_id_fkey(name)').eq('id', id).single();
  const { data: sc } = await supabase.from('schemes').select('name').eq('id', schemeId).single();
  const { error } = await supabase.from('applications').update({ scheme_id: schemeId }).eq('id', id);
  if (error) return err(error.message.includes('applications_one_active') ? 'Peserta sudah punya pendaftaran aktif lain di skema itu.' : error.message);
  await logChange(supabase, user.id, id, 'ubah_skema', { dari: (a as any)?.schemes?.name, ke: sc?.name });
  if (reprice) { const { error: e2 } = await supabase.rpc('admin_reprice', { p_app: id }); if (e2) return err('Skema diubah, tapi harga gagal dihitung ulang: ' + e2.message); }
  done(id); return { ok: true };
}
export async function adminUpdateData(id: string, d: Record<string, string>): Promise<Res> {
  const { supabase, user } = await requireStaff('admin');
  const keys = ['full_name', 'nik', 'birth_place', 'birth_date', 'gender', 'address_ktp', 'city', 'province', 'phone', 'email', 'education', 'occupation', 'workplace', 'experience_years', 'siapkerja_email', 'siapkerja_phone'];
  const patch: any = {};
  for (const k of keys) if (k in d) patch[k] = (d[k] ?? '').toString().trim() || null;
  if (patch.nik && !/^[0-9]{16}$/.test(patch.nik)) return err('NIK harus 16 digit angka.');
  if (patch.gender && !['L', 'P'].includes(patch.gender)) return err('Jenis kelamin: L atau P.');
  if (patch.experience_years != null) patch.experience_years = Number(String(patch.experience_years).replace(',', '.'));
  const { error } = await supabase.from('applications').update(patch).eq('id', id);
  if (error) return err(error.message);
  await logChange(supabase, user.id, id, 'ubah_data_peserta', { kolom: Object.keys(patch) });
  done(id); return { ok: true };
}
export async function adminDeleteApplication(id: string, confirmText: string): Promise<Res> {
  const { supabase } = await requireStaff('super');
  const { error } = await supabase.rpc('admin_delete_application', { p_app: id, p_confirm: confirmText });
  revalidatePath('/admin/pendaftar'); revalidatePath('/admin');
  return error ? err(error.message) : { ok: true };
}

export async function repriceAll(): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { data, error } = await supabase.rpc('admin_reprice_all');
  revalidatePath('/admin'); revalidatePath('/admin/cek-harga');
  return error ? err(error.message) : { ok: true, data };
}
export async function repriceOne(id: string): Promise<Res> {
  const { supabase } = await requireStaff('admin');
  const { error } = await supabase.rpc('admin_reprice', { p_app: id });
  revalidatePath('/admin'); revalidatePath('/admin/cek-harga');
  return error ? err(error.message) : { ok: true };
}

/* ======================= UPLOAD DOKUMEN PESERTA OLEH ADMIN ======================= */
const MIME_EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };
const ACCEPT_MIMES: Record<string, string[]> = { image: ['image/jpeg', 'image/png'], pdf: ['application/pdf'], image_pdf: ['image/jpeg', 'image/png', 'application/pdf'] };

async function adminLog(db: any, actorId: string, appId: string, action: string, detail: any) {
  const { data: a } = await db.from('applications').select('reg_code,full_name').eq('id', appId).maybeSingle();
  await db.from('admin_change_logs').insert({ application_id: appId, reg_code: a?.reg_code, full_name: a?.full_name, actor_id: actorId, action, detail });
}

/** Langkah 1: minta link upload sekali pakai (berlaku untuk admin & verifikator). */
export async function adminDocUploadUrl(appId: string, docCode: string, mime: string, size: number): Promise<Res> {
  await requireStaff();
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const db = createAdminClient();
  const [{ data: a }, { data: d }] = await Promise.all([
    db.from('applications').select('id,user_id').eq('id', appId).maybeSingle(),
    db.from('required_documents').select('code,accept,filled_by').eq('code', docCode).maybeSingle(),
  ]);
  if (!a) return err('Pendaftaran tidak ditemukan.');
  if (!d) return err('Jenis dokumen tidak dikenal.');
  if (!(ACCEPT_MIMES[d.accept] || ACCEPT_MIMES.image_pdf).includes(mime)) return err('Format file tidak sesuai untuk dokumen ini.');
  if (!(size > 0 && size <= 10 * 1024 * 1024)) return err('Maksimal 10 MB.');
  const path = `${a.user_id}/${a.id}/tim-rev-${d.code}-${Date.now()}.${MIME_EXT[mime]}`;
  const { data, error } = await db.storage.from('application-documents').createSignedUploadUrl(path);
  if (error || !data) return err(error?.message || 'Gagal menyiapkan upload.');
  return { ok: true, data: { path, token: data.token } };
}

/** Langkah 2: catat dokumen sebagai versi terbaru (versi lama tetap tersimpan). */
export async function adminRecordDocument(appId: string, doc: { type: string; path: string; name: string; mime: string; size: number }): Promise<Res> {
  const { user } = await requireStaff();
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const db = createAdminClient();
  const { data: a } = await db.from('applications').select('user_id').eq('id', appId).maybeSingle();
  if (!a || !doc.path.startsWith(`${a.user_id}/${appId}/tim-rev-${doc.type}-`)) return err('Lokasi file tidak valid.');
  const { error } = await db.from('application_documents').insert({
    application_id: appId, doc_type: doc.type, storage_path: doc.path, file_name: doc.name.slice(0, 200), mime_type: doc.mime, size_bytes: doc.size });
  if (error) return err(error.message);
  await adminLog(db, user.id, appId, 'upload_dokumen_admin', { dokumen: doc.type, file: doc.name.slice(0, 200) });
  revalidatePath(`/admin/pendaftar/${appId}`); revalidatePath(`/akun/pendaftaran/${appId}`);
  return { ok: true };
}

/** Setelah admin membereskan dokumen: kembalikan status "Perlu perbaikan" → antrean verifikasi. */
export async function adminBackToVerification(appId: string): Promise<Res> {
  const { user } = await requireStaff();
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const db = createAdminClient();
  const { data, error } = await db.from('applications').update({ status: 'submitted' })
    .eq('id', appId).eq('status', 'revision_required').select('id');
  if (error) return err(error.message);
  if (!data?.length) return err('Status pendaftaran ini bukan "Perlu perbaikan".');
  await adminLog(db, user.id, appId, 'kembali_ke_verifikasi', { dari: 'revision_required', ke: 'submitted' });
  revalidatePath(`/admin/pendaftar/${appId}`); revalidatePath('/admin'); revalidatePath('/admin/verifikasi');
  return { ok: true };
}
