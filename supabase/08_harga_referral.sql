-- =====================================================================
-- 08_harga_referral.sql — harga per jadwal per skema, koordinator referral (markup),
-- dan template email tambahan. Jalankan SEKALI setelah 07.
-- =====================================================================

-- ---------- 1. Harga khusus per jadwal per skema ----------
create table if not exists public.exam_schedule_prices (
  schedule_id  uuid not null references public.exam_schedules(id) on delete cascade,
  scheme_id    uuid not null references public.schemes(id) on delete cascade,
  price        numeric(12,0) not null check (price >= 0),
  primary key (schedule_id, scheme_id)
);

-- ---------- 2. Koordinator & markup ----------
create table if not exists public.coordinators (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9_-]{2,30}$'),
  name        text not null,
  phone       text,
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists public.coordinator_markups (
  id              uuid primary key default gen_random_uuid(),
  coordinator_id  uuid not null references public.coordinators(id) on delete cascade,
  scheme_id       uuid references public.schemes(id) on delete cascade,   -- null = berlaku untuk semua skema
  markup_type     text not null default 'amount' check (markup_type in ('amount','percent')),
  value           numeric(12,2) not null check (value >= 0)
);
create unique index if not exists coordinator_markups_uniq
  on public.coordinator_markups (coordinator_id, coalesce(scheme_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.applications add column if not exists coordinator_id uuid references public.coordinators(id);
alter table public.applications add column if not exists base_amount numeric(12,0);
alter table public.applications add column if not exists markup_amount numeric(12,0);
create index if not exists applications_coordinator_idx on public.applications (coordinator_id);

alter table public.exam_schedule_prices enable row level security;
alter table public.coordinators enable row level security;
alter table public.coordinator_markups enable row level security;
drop policy if exists esp_admin on public.exam_schedule_prices;
drop policy if exists coord_admin on public.coordinators;
drop policy if exists coord_staff_read on public.coordinators;
drop policy if exists cm_admin on public.coordinator_markups;
create policy esp_admin on public.exam_schedule_prices for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coord_admin on public.coordinators for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coord_staff_read on public.coordinators for select to authenticated using (public.is_staff());
create policy cm_admin on public.coordinator_markups for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 3. Rumus harga ----------
-- dasar = harga khusus jadwal (jika diisi) atau harga skema; markup = aturan koordinator untuk skema itu
-- (jika tidak ada, aturan "semua skema"); total = dasar + markup
create or replace function public.price_for(p_scheme uuid, p_session uuid, p_coordinator uuid default null)
returns table (base numeric, markup numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare b numeric; m numeric := 0; r record;
begin
  select coalesce(esp.price, sc.price) into b
    from public.schemes sc
    left join public.exam_sessions s on s.id = p_session
    left join public.exam_schedule_prices esp on esp.schedule_id = s.schedule_id and esp.scheme_id = sc.id
   where sc.id = p_scheme;
  if p_coordinator is not null and exists (select 1 from public.coordinators where id = p_coordinator and is_active) then
    select markup_type, value into r from public.coordinator_markups
     where coordinator_id = p_coordinator and (scheme_id = p_scheme or scheme_id is null)
     order by scheme_id nulls last limit 1;
    if found then
      m := case when r.markup_type = 'percent' then round(b * r.value / 100) else r.value end;
    end if;
  end if;
  return query select b, m, b + m;
end $$;

create or replace function public.resolve_coordinator(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.coordinators where code = upper(trim(p_code)) and is_active
$$;

-- ---------- 4. Sesi tersedia + harga final ----------
drop function if exists public.available_sessions(text);
create or replace function public.available_sessions(p_scheme_slug text, p_coordinator uuid default null)
returns table (schedule_id uuid, title text, exam_date date, tuk text, address text,
               session_id uuid, session_name text, start_time time, end_time time, quota int, seats_left int, price numeric)
language sql stable security definer set search_path = public as $$
  select j.id, j.title, j.exam_date, j.tuk, j.address, s.id, s.name, s.start_time, s.end_time, s.quota,
         public.session_seats_left(s.id), (select total from public.price_for(sc.id, s.id, p_coordinator))
    from public.schemes sc
    join public.exam_schedule_schemes x on x.scheme_id = sc.id
    join public.exam_schedules j on j.id = x.schedule_id
    join public.exam_sessions s on s.schedule_id = j.id
   where sc.slug = p_scheme_slug and sc.is_active and public.session_accepts(s.id, sc.id)
   order by j.exam_date, s.sort_order, s.start_time
$$;

-- ---------- 5. Penjaga: koordinator & harga tidak bisa diubah peserta ----------
create or replace function public.guard_application_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('emki.system', true) = 'on' or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if old.user_id <> auth.uid() then raise exception 'Akses ditolak'; end if;
  if old.status not in ('draft','revision_required') then
    raise exception 'Pendaftaran tidak dapat diubah pada status %', old.status;
  end if;
  if new.status is distinct from old.status or new.reg_code is distinct from old.reg_code
     or new.amount is distinct from old.amount or new.user_id is distinct from old.user_id
     or new.base_amount is distinct from old.base_amount or new.markup_amount is distinct from old.markup_amount
     or new.coordinator_id is distinct from old.coordinator_id
     or new.verified_at is distinct from old.verified_at or new.verified_by is distinct from old.verified_by
     or new.verifier_note is distinct from old.verifier_note or new.recommended_scheme_id is distinct from old.recommended_scheme_id
     or new.payment_due_at is distinct from old.payment_due_at or new.paid_at is distinct from old.paid_at
     or new.submitted_at is distinct from old.submitted_at or new.exam_result is distinct from old.exam_result
     or new.admin_notes is distinct from old.admin_notes or new.original_scheme_id is distinct from old.original_scheme_id then
    raise exception 'Kolom ini hanya dapat diubah oleh sistem';
  end if;
  if new.scheme_id is distinct from old.scheme_id and old.status <> 'draft' then
    raise exception 'Skema hanya dapat diganti saat masih draft';
  end if;
  return new;
end $$;

-- koordinator hanya boleh diisi saat membuat pendaftaran, dan harus koordinator aktif
create or replace function public.check_application_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.coordinator_id is not null and not exists (select 1 from public.coordinators where id = new.coordinator_id and is_active) then
    new.coordinator_id := null;
  end if;
  new.amount := null; new.base_amount := null; new.markup_amount := null;
  return new;
end $$;
drop trigger if exists trg_check_application_insert on public.applications;
create trigger trg_check_application_insert before insert on public.applications
  for each row execute function public.check_application_insert();

-- ---------- 6. Kirim pendaftaran: harga final dikunci ----------
create or replace function public.submit_application(p_id uuid)
returns public.applications language plpgsql security definer set search_path = public as $$
declare a public.applications; sc public.schemes; missing text[] := '{}'; held boolean; r record; pr record;
begin
  select * into a from public.applications where id = p_id for update;
  if not found or a.user_id <> auth.uid() then raise exception 'Pendaftaran tidak ditemukan'; end if;
  if a.status not in ('draft','revision_required') then raise exception 'Pendaftaran sudah dikirim'; end if;
  select * into sc from public.schemes where id = a.scheme_id;
  if not sc.is_active then raise exception 'Skema ini sedang tidak dibuka'; end if;

  if a.full_name is null or trim(a.full_name) = '' then missing := missing || 'Nama lengkap'; end if;
  if a.nik is null then missing := missing || 'NIK'; end if;
  if a.birth_place is null then missing := missing || 'Tempat lahir'; end if;
  if a.birth_date is null then missing := missing || 'Tanggal lahir'; end if;
  if a.gender is null then missing := missing || 'Jenis kelamin'; end if;
  if a.address_ktp is null then missing := missing || 'Alamat sesuai KTP'; end if;
  if a.city is null then missing := missing || 'Kota'; end if;
  if a.province is null then missing := missing || 'Provinsi'; end if;
  if a.phone is null then missing := missing || 'No. telepon'; end if;
  if a.email is null then missing := missing || 'Email'; end if;
  if a.education is null then missing := missing || 'Pendidikan'; end if;
  if a.occupation is null then missing := missing || 'Pekerjaan'; end if;
  if a.workplace is null then missing := missing || 'PT/Institusi'; end if;
  if a.experience_years is null then missing := missing || 'Lama pengalaman kerja'; end if;
  if a.siapkerja_email is null then missing := missing || 'Email SIAPkerja'; end if;
  if a.siapkerja_phone is null then missing := missing || 'No. telepon SIAPkerja'; end if;
  if not exists (select 1 from public.application_secrets where application_id = a.id) then missing := missing || 'Password SIAPkerja'; end if;
  for r in select code, label from public.custom_fields
            where is_active and is_required and (scheme_ids is null or a.scheme_id = any(scheme_ids)) order by sort_order loop
    if coalesce(trim(a.extra_answers ->> r.code), '') = '' then missing := missing || r.label; end if;
  end loop;
  for r in select d.code, d.name from public.required_documents d
            where d.is_active and d.is_required and (d.scheme_ids is null or a.scheme_id = any(d.scheme_ids)) order by d.sort_order loop
    if not exists (select 1 from public.application_documents x where x.application_id = a.id and x.doc_type = r.code and x.is_current) then
      missing := missing || ('Dokumen: ' || r.name);
    end if;
  end loop;
  if a.consent_at is null then missing := missing || 'Persetujuan'; end if;
  if a.session_id is null then missing := missing || 'Tanggal & sesi Ujikom'; end if;
  if array_length(missing, 1) > 0 then raise exception 'Data belum lengkap: %', array_to_string(missing, ', '); end if;

  perform 1 from public.exam_sessions where id = a.session_id for update;
  if not public.session_accepts(a.session_id, a.scheme_id) then
    raise exception 'Jadwal yang dipilih sudah ditutup atau tidak tersedia untuk skema ini';
  end if;
  held := a.status = 'revision_required';
  if not held and public.session_seats_left(a.session_id) <= 0 then
    raise exception 'Kuota sesi yang dipilih sudah penuh. Silakan pilih sesi lain';
  end if;
  select * into pr from public.price_for(a.scheme_id, a.session_id, a.coordinator_id);

  perform set_config('emki.system', 'on', true);
  update public.applications set
    reg_code = coalesce(reg_code, public.next_reg_code()),
    amount        = case when held and amount is not null then amount        else pr.total  end,
    base_amount   = case when held and amount is not null then base_amount   else pr.base   end,
    markup_amount = case when held and amount is not null then markup_amount else pr.markup end,
    submitted_at = now(),
    status = case when sc.requires_verification then 'submitted'::application_status else 'awaiting_payment'::application_status end,
    payment_due_at = case when sc.requires_verification then null else now() + interval '72 hours' end
  where id = a.id returning * into a;
  return a;
end $$;

-- ---------- 7. Terima rekomendasi: harga skema baru (lokasi + markup) ----------
create or replace function public.accept_recommendation(p_id uuid, p_session_id uuid default null)
returns public.applications language plpgsql security definer set search_path = public as $$
declare a public.applications; new_session uuid; pr record;
begin
  select * into a from public.applications where id = p_id for update;
  if not found or a.user_id <> auth.uid() then raise exception 'Pendaftaran tidak ditemukan'; end if;
  if a.status <> 'recommended' or a.recommended_scheme_id is null then raise exception 'Tidak ada rekomendasi untuk diterima'; end if;
  new_session := coalesce(p_session_id, a.session_id);
  if not public.session_accepts(new_session, a.recommended_scheme_id) then
    raise exception 'Jadwal saat ini tidak tersedia untuk skema rekomendasi. Silakan pilih jadwal lain';
  end if;
  if new_session <> a.session_id then
    perform 1 from public.exam_sessions where id = new_session for update;
    if public.session_seats_left(new_session) <= 0 then raise exception 'Kuota sesi yang dipilih sudah penuh'; end if;
  end if;
  select * into pr from public.price_for(a.recommended_scheme_id, new_session, a.coordinator_id);
  perform set_config('emki.system', 'on', true);
  update public.applications set
    original_scheme_id = coalesce(original_scheme_id, scheme_id),
    scheme_id = recommended_scheme_id, recommended_scheme_id = null, session_id = new_session,
    amount = pr.total, base_amount = pr.base, markup_amount = pr.markup,
    status = 'awaiting_payment', payment_due_at = now() + interval '72 hours'
  where id = a.id returning * into a;
  return a;
end $$;

-- ---------- 8. Hak eksekusi ----------
revoke execute on function public.price_for(uuid, uuid, uuid), public.resolve_coordinator(text) from public, anon;
grant execute on function public.price_for(uuid, uuid, uuid) to authenticated;
grant execute on function public.resolve_coordinator(text) to anon, authenticated;
grant execute on function public.available_sessions(text, uuid) to anon, authenticated;
grant execute on function public.submit_application(uuid), public.accept_recommendation(uuid, uuid) to authenticated;
revoke execute on function public.submit_application(uuid), public.accept_recommendation(uuid, uuid) from public, anon;

-- ---------- 9. Template email tambahan ----------
insert into public.message_templates (key, channel, title, subject, body, sort_order) values
('email_revisi','email','Perlu perbaikan','Perlu perbaikan — {reg_code}',
'Halo {nama},

Pendaftaran Sertifikasi BNSP {skema} Anda ({reg_code}) perlu perbaikan:

{catatan}

Silakan perbarui melalui akun Anda: {link}

Tim EMKI',14),
('email_rekomendasi','email','Rekomendasi skema','Rekomendasi skema untuk {reg_code}',
'Halo {nama},

Berdasarkan dokumen Anda, tim verifikator merekomendasikan skema {skema_rekomendasi}.

Catatan: {catatan}

Lihat dan setujui rekomendasi di akun Anda: {link}

Tim EMKI',15),
('email_ditolak','email','Pendaftaran tidak dapat dilanjutkan','Informasi pendaftaran {reg_code}',
'Halo {nama},

Mohon maaf, pendaftaran Sertifikasi BNSP {skema} Anda ({reg_code}) belum dapat dilanjutkan.

Catatan: {catatan}

Silakan hubungi admin kami melalui WhatsApp untuk informasi lebih lanjut.

Tim EMKI',16)
on conflict (key) do nothing;
