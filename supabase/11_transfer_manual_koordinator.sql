-- =====================================================================
-- 11_transfer_manual_koordinator.sql — jalankan SETELAH file 10.
--  1. Pembayaran transfer manual (rekening, bukti transfer, konfirmasi)
--  2. Portal koordinator (lihat peserta sendiri, upload screenshot Sisfo, komisi)
--  3. Komisi: markup, atau komisi tetap (default Rp 100.000) jika tanpa markup
-- =====================================================================

-- ---------- Pengaturan & rekening ----------
create table if not exists public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
insert into public.app_settings (key, value) values ('payment_method', '"manual"') on conflict (key) do nothing;

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank text not null, account_number text not null, account_name text not null,
  is_active boolean not null default true, sort_order int not null default 0, created_at timestamptz not null default now());

-- ---------- Bukti transfer ----------
create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  storage_path text not null, file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  sender_name text not null, sender_bank text not null, transfer_date date not null,
  amount numeric(12,0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text, reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
  created_at timestamptz not null default now());
create index if not exists payment_proofs_status_idx on public.payment_proofs (status, created_at);

-- ---------- Koordinator: akun login & komisi tetap ----------
alter table public.coordinators add column if not exists user_id uuid unique references public.profiles(id) on delete set null;
alter table public.coordinators add column if not exists flat_commission numeric(12,0) not null default 100000 check (flat_commission >= 0);
alter table public.applications add column if not exists commission_amount numeric(12,0);

-- komisi dihitung otomatis: markup (jika ada) atau komisi tetap koordinator
create or replace function public.set_commission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.coordinator_id is null or new.amount is null then new.commission_amount := null; return new; end if;
  if tg_op = 'INSERT' or new.amount is distinct from old.amount or new.markup_amount is distinct from old.markup_amount
     or new.coordinator_id is distinct from old.coordinator_id or new.commission_amount is null then
    new.commission_amount := case when coalesce(new.markup_amount, 0) > 0 then new.markup_amount
                                  else (select flat_commission from public.coordinators where id = new.coordinator_id) end;
  end if;
  return new;
end $$;
drop trigger if exists trg_set_commission on public.applications;
create trigger trg_set_commission before insert or update on public.applications
  for each row execute function public.set_commission();
-- hitung untuk data yang sudah ada
update public.applications set commission_amount = null where coordinator_id is not null and amount is not null;

-- dokumen yang diisi tim (bukan peserta), mis. screenshot Sisfo BNSP
alter table public.required_documents add column if not exists filled_by text not null default 'participant' check (filled_by in ('participant','staff'));
insert into public.required_documents (code, name, description, accept, is_required, sort_order, filled_by)
values ('screenshot_sisfo','Screenshot Sisfo BNSP','Diisi koordinator / Super Admin setelah peserta diinput ke Sisfo BNSP.','image_pdf', false, 90, 'staff')
on conflict (code) do nothing;
-- dokumen yang diisi tim tidak boleh "wajib" (peserta tidak bisa mengunggahnya)
update public.required_documents set is_required = false where filled_by = 'staff';
do $$ begin
  alter table public.required_documents add constraint staff_doc_not_required check (not (filled_by = 'staff' and is_required));
exception when duplicate_object then null; end $$;

-- ---------- Helper peran ----------
create or replace function public.is_coordinator_of(p_application uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.applications a join public.coordinators c on c.id = a.coordinator_id
     where a.id = p_application and c.user_id = auth.uid() and c.is_active)
$$;
create or replace function public.my_coordinator_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.coordinators where user_id = auth.uid() and is_active
$$;
grant execute on function public.is_coordinator_of(uuid), public.my_coordinator_id() to authenticated;

-- ---------- Kursi: status menunggu konfirmasi tetap memegang kursi ----------
create or replace function public.session_seats_taken(p_session uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.applications a
   where a.session_id = p_session
     and ( a.status in ('submitted','revision_required','recommended','payment_review','paid')
        or (a.status = 'awaiting_payment' and a.payment_due_at > now()) )
$$;

-- ---------- Peserta kirim bukti transfer ----------
create or replace function public.submit_payment_proof(p_application uuid, p_path text, p_file_name text, p_mime text, p_size bigint,
  p_sender_name text, p_sender_bank text, p_transfer_date date)
returns public.applications language plpgsql security definer set search_path = public as $$
declare a public.applications;
begin
  select * into a from public.applications where id = p_application for update;
  if not found or a.user_id <> auth.uid() then raise exception 'Pendaftaran tidak ditemukan'; end if;
  if a.status <> 'awaiting_payment' then raise exception 'Pendaftaran ini tidak sedang menunggu pembayaran'; end if;
  if a.payment_due_at < now() then raise exception 'Batas pembayaran sudah lewat. Hubungi admin'; end if;
  if p_path not like auth.uid()::text || '/' || a.id::text || '/bukti-%' then raise exception 'Lokasi file tidak valid'; end if;
  if coalesce(trim(p_sender_name),'') = '' or coalesce(trim(p_sender_bank),'') = '' or p_transfer_date is null then
    raise exception 'Lengkapi nama pengirim, bank pengirim, dan tanggal transfer';
  end if;
  insert into public.payment_proofs (application_id, storage_path, file_name, mime_type, size_bytes, sender_name, sender_bank, transfer_date, amount)
  values (a.id, p_path, left(p_file_name, 200), p_mime, p_size, trim(p_sender_name), trim(p_sender_bank), p_transfer_date, a.amount);
  perform set_config('emki.system', 'on', true);
  update public.applications set status = 'payment_review' where id = a.id returning * into a;
  return a;
end $$;

-- ---------- Verifikator / Super Admin konfirmasi ----------
create or replace function public.review_payment(p_proof uuid, p_approve boolean, p_note text default null)
returns public.applications language plpgsql security definer set search_path = public as $$
declare pf public.payment_proofs; a public.applications; n int; exam date;
begin
  if not public.is_staff() then raise exception 'Hanya verifikator/Super Admin (dengan verifikasi 2 langkah)'; end if;
  select * into pf from public.payment_proofs where id = p_proof for update;
  if not found or pf.status <> 'pending' then raise exception 'Bukti ini sudah diproses'; end if;
  select * into a from public.applications where id = pf.application_id for update;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception 'Tulis alasan penolakan'; end if;
  update public.payment_proofs set status = case when p_approve then 'approved' else 'rejected' end,
    review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = pf.id;
  perform set_config('emki.system', 'on', true);
  if p_approve then
    select count(*) into n from public.payments where application_id = a.id;
    insert into public.payments (application_id, order_id, amount, status, payment_type, paid_at)
    values (a.id, a.reg_code || '-TF' || (n + 1), a.amount, 'paid', 'transfer_manual', now());
    update public.applications set status = 'paid', paid_at = now() where id = a.id returning * into a;
    select j.exam_date into exam from public.exam_sessions s join public.exam_schedules j on j.id = s.schedule_id where s.id = a.session_id;
    update public.application_secrets set purge_after = exam + 14 where application_id = a.id;
  else
    update public.applications set status = 'awaiting_payment', payment_due_at = greatest(payment_due_at, now() + interval '48 hours')
     where id = a.id returning * into a;
  end if;
  return a;
end $$;

-- ---------- Tampilkan password SIAPkerja: + verifikator + koordinator (pesertanya sendiri) ----------
create or replace function public.admin_reveal_secret(p_application uuid, p_reason text default null, p_ip text default null)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not (public.is_staff() or public.is_coordinator_of(p_application)) then
    raise exception 'Tidak berwenang (wajib verifikasi 2 langkah)';
  end if;
  select siapkerja_password_enc into c from public.application_secrets where application_id = p_application;
  if c is null then raise exception 'Password tidak tersedia (belum diisi atau sudah dihapus otomatis)'; end if;
  insert into public.secret_access_logs (application_id, accessed_by, reason, ip_address) values (p_application, auth.uid(), p_reason, p_ip);
  return c;
end $$;

-- ---------- Urutan sesi: ikutkan status menunggu konfirmasi ----------
create or replace function public.admin_rebalance_sessions(p_schedule uuid, p_apply boolean default false)
returns table (application_id uuid, full_name text, scheme_name text, from_session text, to_session text, to_session_id uuid)
language plpgsql security definer set search_path = public as $$
declare a record; sess uuid[]; quotas int[]; names text[]; i int := 1; used int := 0;
begin
  if not public.is_admin() then raise exception 'Hanya Super Admin'; end if;
  select array_agg(id order by sort_order, start_time), array_agg(quota order by sort_order, start_time), array_agg(name order by sort_order, start_time)
    into sess, quotas, names from public.exam_sessions where schedule_id = p_schedule;
  if sess is null then return; end if;
  if p_apply then perform set_config('emki.system', 'on', true); end if;
  for a in
    select ap.id, ap.full_name, sc.name as sname, ap.session_id, os.name as oname
      from public.applications ap join public.schemes sc on sc.id = ap.scheme_id join public.exam_sessions os on os.id = ap.session_id
     where os.schedule_id = p_schedule
       and ( ap.status in ('submitted','revision_required','recommended','payment_review','paid')
          or (ap.status = 'awaiting_payment' and ap.payment_due_at > now()) )
     order by sc.level_order desc, coalesce(ap.paid_at, ap.submitted_at, ap.created_at) asc
  loop
    while used >= quotas[i] and i < array_length(sess, 1) loop i := i + 1; used := 0; end loop;
    used := used + 1;
    if a.session_id <> sess[i] then
      application_id := a.id; full_name := a.full_name; scheme_name := a.sname;
      from_session := a.oname; to_session := names[i]; to_session_id := sess[i];
      if p_apply then update public.applications set session_id = sess[i] where id = a.id; end if;
      return next;
    end if;
  end loop;
end $$;

-- ---------- Hak akses (RLS) ----------
alter table public.app_settings enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.payment_proofs enable row level security;
drop policy if exists set_read on public.app_settings;            drop policy if exists set_admin on public.app_settings;
drop policy if exists bank_read on public.bank_accounts;          drop policy if exists bank_admin on public.bank_accounts;
drop policy if exists proof_read on public.payment_proofs;
create policy set_read on public.app_settings for select to anon, authenticated using (true);
create policy set_admin on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy bank_read on public.bank_accounts for select to authenticated using (is_active or public.is_admin());
create policy bank_admin on public.bank_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy proof_read on public.payment_proofs for select to authenticated
  using (public.is_staff() or exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid()));

-- koordinator: baca pendaftaran & dokumen pesertanya sendiri, upload dokumen yang diisi tim
drop policy if exists app_select_coord on public.applications;
create policy app_select_coord on public.applications for select to authenticated using (public.is_coordinator_of(id));
drop policy if exists doc_select_coord on public.application_documents;
create policy doc_select_coord on public.application_documents for select to authenticated using (public.is_coordinator_of(application_id));
drop policy if exists doc_insert_staff on public.application_documents;
create policy doc_insert_staff on public.application_documents for insert to authenticated
  with check ((public.is_admin() or public.is_coordinator_of(application_id))
              and exists (select 1 from public.required_documents d where d.code = doc_type and d.filled_by = 'staff'));
drop policy if exists coord_self_read on public.coordinators;
create policy coord_self_read on public.coordinators for select to authenticated using (user_id = auth.uid());
drop policy if exists vlog_select_coord on public.verification_logs;
create policy vlog_select_coord on public.verification_logs for select to authenticated using (public.is_coordinator_of(application_id));

-- storage: bukti transfer (peserta), dokumen tim (koordinator/Super Admin), baca untuk koordinator
drop policy if exists "bukti: upload peserta" on storage.objects;
create policy "bukti: upload peserta" on storage.objects for insert to authenticated
  with check (bucket_id = 'application-documents' and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.filename(name)) like 'bukti-%'
    and exists (select 1 from public.applications a where a.id = ((storage.foldername(name))[2])::uuid and a.user_id = auth.uid() and a.status = 'awaiting_payment'));
drop policy if exists "dok: upload tim" on storage.objects;
create policy "dok: upload tim" on storage.objects for insert to authenticated
  with check (bucket_id = 'application-documents' and (storage.filename(name)) like 'tim-%'
    and (public.is_admin() or public.is_coordinator_of(((storage.foldername(name))[2])::uuid)));
drop policy if exists "dok: lihat koordinator" on storage.objects;
create policy "dok: lihat koordinator" on storage.objects for select to authenticated
  using (bucket_id = 'application-documents' and public.is_coordinator_of(((storage.foldername(name))[2])::uuid));

grant execute on function public.submit_payment_proof(uuid,text,text,text,bigint,text,text,date), public.review_payment(uuid,boolean,text) to authenticated;
revoke execute on function public.submit_payment_proof(uuid,text,text,text,bigint,text,text,date), public.review_payment(uuid,boolean,text) from public, anon;

-- ---------- Template email ----------
insert into public.message_templates (key, channel, title, subject, body, sort_order) values
('email_siap_bayar_transfer','email','Siap bayar (transfer)','Silakan lanjutkan pembayaran — {reg_code}',
'Halo {nama},

Pendaftaran Sertifikasi BNSP {skema} Anda siap dibayar sebesar {nominal}.
Batas pembayaran: {batas_bayar}

Silakan transfer ke rekening yang tertera di akun Anda, lalu unggah bukti transfer di sini:
{link}

Tim EMKI',11),
('email_bukti_diterima','email','Bukti transfer diterima','Bukti transfer diterima — {reg_code}',
'Halo {nama},

Bukti transfer untuk pendaftaran {skema} ({reg_code}) sudah kami terima dan sedang dicek. Kami akan mengabari setelah pembayaran dikonfirmasi.

Tim EMKI',18),
('email_bukti_ditolak','email','Bukti transfer perlu diperbaiki','Konfirmasi pembayaran belum berhasil — {reg_code}',
'Halo {nama},

Bukti transfer untuk pendaftaran {skema} ({reg_code}) belum dapat kami konfirmasi.

Alasan: {catatan}

Silakan periksa kembali dan unggah bukti yang benar melalui akun Anda sebelum {batas_bayar}:
{link}

Tim EMKI',19)
on conflict (key) do nothing;
