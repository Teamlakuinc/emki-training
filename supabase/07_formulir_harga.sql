-- =====================================================================
-- 07_formulir_harga.sql — Dokumen wajib & pertanyaan tambahan bisa diatur dari panel,
-- harga dikunci saat pendaftaran dikirim.
-- Jalankan SEKALI di SQL Editor (setelah 01–06 yang sudah pernah dijalankan).
-- =====================================================================

-- ---------- 1. Daftar dokumen wajib (bisa diatur admin) ----------
create table if not exists public.required_documents (
  code          text primary key,                 -- mis. 'pas_foto'
  name          text not null,                    -- mis. 'Pas foto latar belakang merah'
  description   text,
  accept        text not null default 'image_pdf' check (accept in ('image','pdf','image_pdf')),
  is_required   boolean not null default true,
  scheme_ids    uuid[],                           -- null = semua skema
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
insert into public.required_documents (code, name, description, accept, sort_order) values
 ('pas_foto','Pas foto latar belakang merah','JPG atau PNG, maksimal 10 MB.','image',1),
 ('qr_siapkerja','Capture QR Code akun SIAPkerja','Screenshot dari aplikasi/situs SIAPkerja. JPG atau PNG.','image',2),
 ('cv_portfolio_paklaring','CV, portfolio & paklaring (1 PDF)','Urutan: CV → portfolio → paklaring, digabung menjadi satu PDF. Maksimal 10 MB.','pdf',3)
on conflict (code) do nothing;

-- kolom jenis dokumen jadi teks bebas yang merujuk ke daftar di atas
alter table public.application_documents drop constraint if exists doc_mime_ok;
alter table public.application_documents alter column doc_type type text using doc_type::text;
do $$ begin
  alter table public.application_documents add constraint application_documents_doc_type_fkey
    foreign key (doc_type) references public.required_documents(code) on update cascade on delete restrict;
exception when duplicate_object then null; end $$;

-- format file harus sesuai pengaturan dokumen
create or replace function public.check_document_mime()
returns trigger language plpgsql security definer set search_path = public as $$
declare acc text;
begin
  select accept into acc from public.required_documents where code = new.doc_type;
  if acc is null then raise exception 'Jenis dokumen tidak dikenal'; end if;
  if (acc = 'image' and new.mime_type not in ('image/jpeg','image/png'))
     or (acc = 'pdf' and new.mime_type <> 'application/pdf') then
    raise exception 'Format file tidak sesuai untuk dokumen ini';
  end if;
  return new;
end $$;
drop trigger if exists trg_check_document_mime on public.application_documents;
create trigger trg_check_document_mime before insert on public.application_documents
  for each row execute function public.check_document_mime();

-- ---------- 2. Pertanyaan tambahan (bisa diatur admin) ----------
create table if not exists public.custom_fields (
  code          text primary key,                 -- mis. 'ukuran_baju'
  label         text not null,
  help_text     text,
  field_type    text not null default 'text' check (field_type in ('text','textarea','number','date','select')),
  options       text[],                           -- untuk field_type 'select'
  is_required   boolean not null default false,
  scheme_ids    uuid[],                           -- null = semua skema
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.applications add column if not exists extra_answers jsonb not null default '{}'::jsonb;

-- ---------- 3. Hak akses ----------
alter table public.required_documents enable row level security;
alter table public.custom_fields enable row level security;
drop policy if exists reqdoc_read on public.required_documents;
drop policy if exists reqdoc_admin on public.required_documents;
drop policy if exists cf_read on public.custom_fields;
drop policy if exists cf_admin on public.custom_fields;
create policy reqdoc_read on public.required_documents for select to anon, authenticated using (is_active or public.is_admin());
create policy reqdoc_admin on public.required_documents for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cf_read on public.custom_fields for select to anon, authenticated using (is_active or public.is_admin());
create policy cf_admin on public.custom_fields for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 4. Harga dikunci saat dikirim: verifikator menyetujui TIDAK mengubah harga ----------
create or replace function public.verifier_decide(p_id uuid, p_decision verify_decision, p_note text default null, p_recommended_scheme uuid default null)
returns public.applications language plpgsql security definer set search_path = public as $$
declare a public.applications; rs public.schemes;
begin
  if not public.is_staff() then raise exception 'Hanya verifikator/admin (dengan verifikasi 2 langkah)'; end if;
  select * into a from public.applications where id = p_id for update;
  if not found then raise exception 'Pendaftaran tidak ditemukan'; end if;
  if a.status <> 'submitted' then raise exception 'Pendaftaran ini tidak sedang menunggu verifikasi'; end if;
  if p_decision <> 'approve' and coalesce(trim(p_note), '') = '' then
    raise exception 'Catatan wajib diisi untuk keputusan selain Setujui';
  end if;
  perform set_config('emki.system', 'on', true);
  if p_decision = 'approve' then
    update public.applications set status = 'awaiting_payment', payment_due_at = now() + interval '72 hours',
      amount = coalesce(amount, (select price from public.schemes where id = a.scheme_id)),
      verified_at = now(), verified_by = auth.uid(), verifier_note = p_note where id = a.id returning * into a;
  elsif p_decision = 'revision' then
    update public.applications set status = 'revision_required', verified_at = now(), verified_by = auth.uid(),
      verifier_note = p_note where id = a.id returning * into a;
  elsif p_decision = 'recommend' then
    select * into rs from public.schemes where id = p_recommended_scheme and is_active;
    if not found or rs.id = a.scheme_id then raise exception 'Pilih skema rekomendasi yang berbeda'; end if;
    update public.applications set status = 'recommended', recommended_scheme_id = rs.id, verified_at = now(),
      verified_by = auth.uid(), verifier_note = p_note where id = a.id returning * into a;
  else
    update public.applications set status = 'rejected', verified_at = now(), verified_by = auth.uid(),
      verifier_note = p_note where id = a.id returning * into a;
  end if;
  insert into public.verification_logs (application_id, verifier_id, decision, note, from_scheme_id, to_scheme_id)
  values (a.id, auth.uid(), p_decision, p_note, a.scheme_id, case when p_decision = 'recommend' then p_recommended_scheme end);
  return a;
end $$;

-- ---------- 5. Kirim pendaftaran: cek dokumen & pertanyaan sesuai pengaturan ----------
create or replace function public.submit_application(p_id uuid)
returns public.applications language plpgsql security definer set search_path = public as $$
declare a public.applications; sc public.schemes; missing text[] := '{}'; held boolean; r record;
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

  perform set_config('emki.system', 'on', true);
  update public.applications set
    reg_code = coalesce(reg_code, public.next_reg_code()),
    amount = case when status = 'revision_required' and amount is not null then amount else sc.price end,  -- harga dikunci saat pertama dikirim
    submitted_at = now(),
    status = case when sc.requires_verification then 'submitted'::application_status else 'awaiting_payment'::application_status end,
    payment_due_at = case when sc.requires_verification then null else now() + interval '72 hours' end
  where id = a.id returning * into a;
  return a;
end $$;

grant execute on function public.submit_application(uuid), public.verifier_decide(uuid, verify_decision, text, uuid) to authenticated;
revoke execute on function public.submit_application(uuid), public.verifier_decide(uuid, verify_decision, text, uuid) from public, anon;
