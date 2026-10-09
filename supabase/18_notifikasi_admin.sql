-- 18. Pusat notifikasi admin (ikon lonceng)
-- Jalankan di Supabase EMKI Training → SQL Editor → Run. Aman dijalankan ulang.

create table if not exists public.admin_notifications (
  id             bigint generated always as identity primary key,
  kind           text not null,          -- verifikasi | pembayaran | dokumen | siapkerja | akun | batal
  title          text not null,
  body           text,
  application_id uuid references public.applications(id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index if not exists admin_notifications_created_idx on public.admin_notifications (created_at desc);

create table if not exists public.admin_notification_seen (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.admin_notifications enable row level security;
alter table public.admin_notification_seen enable row level security;
drop policy if exists an_read on public.admin_notifications;
drop policy if exists ans_rw on public.admin_notification_seen;
create policy an_read on public.admin_notifications for select to authenticated using (public.is_staff());
create policy ans_rw on public.admin_notification_seen for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- apakah yang mengubah adalah staf (perubahan oleh staf tidak perlu dinotifikasi ke staf)
create or replace function public.actor_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('super_admin','admin','verifikator') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.notify_admin(p_kind text, p_title text, p_body text, p_app uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_notifications (kind, title, body, application_id) values (p_kind, p_title, p_body, p_app);
$$;

-- 1) perubahan status & perbaikan SIAPkerja
create or replace function public.trg_notify_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare who text; sch text;
begin
  if public.actor_is_staff() then return new; end if;
  select name into sch from public.schemes where id = new.scheme_id;
  who := coalesce(new.full_name, 'Peserta') || coalesce(' · ' || new.reg_code, '') || coalesce(' · ' || sch, '');

  if new.status is distinct from old.status then
    if new.status = 'submitted' then
      perform public.notify_admin('verifikasi',
        case when old.status = 'revision_required' then 'Perbaikan dikirim ulang, siap diverifikasi' else 'Pendaftaran baru menunggu verifikasi' end, who, new.id);
    elsif new.status = 'awaiting_payment' and old.status = 'draft' then
      perform public.notify_admin('pembayaran', 'Pendaftaran baru (langsung bayar)', who, new.id);
    elsif new.status = 'awaiting_payment' and old.status = 'recommended' then
      perform public.notify_admin('verifikasi', 'Peserta menerima rekomendasi skema', who, new.id);
    elsif new.status = 'payment_review' then
      perform public.notify_admin('pembayaran', 'Bukti transfer masuk, perlu dikonfirmasi', who, new.id);
    elsif new.status = 'paid' then
      perform public.notify_admin('pembayaran', 'Pembayaran lunas', who || coalesce(' · Rp ' || replace(to_char(new.amount, 'FM999,999,999,999'), ',', '.'), ''), new.id);
    elsif new.status = 'expired' then
      perform public.notify_admin('pembayaran', 'Batas bayar lewat (kedaluwarsa)', who, new.id);
    elsif new.status = 'cancelled' then
      perform public.notify_admin('batal', 'Peserta membatalkan pendaftaran', who, new.id);
    end if;
  end if;

  if new.siapkerja_fixed_at is distinct from old.siapkerja_fixed_at and new.siapkerja_fixed_at is not null then
    perform public.notify_admin('siapkerja', 'Peserta memperbarui akun SIAPkerja, silakan coba login lagi', who, new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_application on public.applications;
create trigger trg_notify_application after update on public.applications
  for each row execute function public.trg_notify_application();

-- 2) peserta upload ulang dokumen setelah pendaftaran dikirim
create or replace function public.trg_notify_document()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.applications; dn text;
begin
  if public.actor_is_staff() or auth.uid() is null then return new; end if;
  if new.storage_path like '%/tim-%' then return new; end if;
  select * into a from public.applications where id = new.application_id;
  if a.status = 'draft' then return new; end if;
  select name into dn from public.required_documents where code = new.doc_type;
  perform public.notify_admin('dokumen', 'Peserta mengunggah ulang dokumen: ' || coalesce(dn, new.doc_type::text),
    coalesce(a.full_name, 'Peserta') || coalesce(' · ' || a.reg_code, ''), a.id);
  return new;
end $$;
drop trigger if exists trg_notify_document on public.application_documents;
create trigger trg_notify_document after insert on public.application_documents
  for each row execute function public.trg_notify_document();

-- 3) akun peserta baru
create or replace function public.trg_notify_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'participant' then
    perform public.notify_admin('akun', 'Akun peserta baru', coalesce(new.full_name, '') || coalesce(' · ' || new.phone_wa, '') || coalesce(' · ' || new.email, ''), null);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_profile on public.profiles;
create trigger trg_notify_profile after insert on public.profiles
  for each row execute function public.trg_notify_profile();

-- bersih-bersih otomatis: simpan 90 hari terakhir saja (aman kalau pg_cron belum aktif)
do $$ begin
  perform cron.schedule('emki-clean-notifications', '30 19 * * *', $c$ delete from public.admin_notifications where created_at < now() - interval '90 days' $c$);
exception when others then null; end $$;

notify pgrst, 'reload schema';
