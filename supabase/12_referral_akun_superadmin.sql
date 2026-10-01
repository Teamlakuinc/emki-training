-- =====================================================================
-- 12_referral_akun_superadmin.sql — jalankan SETELAH 10 & 11.
--  1. Koordinator dikunci ke AKUN peserta (bukan hanya browser)
--  2. Kode referral bisa dimasukkan manual oleh peserta
--  3. Super Admin: ubah koordinator (+hitung ulang harga), ubah harga/status/skema/data, hapus pendaftaran
--  4. Riwayat semua perubahan oleh admin
-- =====================================================================

-- 1. koordinator di akun
alter table public.profiles add column if not exists coordinator_id uuid references public.coordinators(id) on delete set null;
alter table public.profiles add column if not exists referred_at timestamptz;

-- akun baru: ambil kode referral yang dibawa saat membuat akun
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select id into c from public.coordinators
   where code = upper(trim(coalesce(new.raw_user_meta_data->>'ref',''))) and is_active;
  insert into public.profiles (id, email, full_name, coordinator_id, referred_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), c, case when c is not null then now() end)
  on conflict (id) do nothing;
  return new;
end $$;

-- peserta: klaim kode referral (link/cookie atau ketik manual). Koordinator pertama yang menang.
-- Draft yang belum punya koordinator ikut ditandai.
create or replace function public.claim_referral(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid; cur uuid;
begin
  if auth.uid() is null then return null; end if;
  select coordinator_id into cur from public.profiles where id = auth.uid();
  if cur is null then
    select id into c from public.coordinators where code = upper(trim(coalesce(p_code,''))) and is_active;
    if c is null then return null; end if;
    update public.profiles set coordinator_id = c, referred_at = now() where id = auth.uid();
    cur := c;
  end if;
  perform set_config('emki.system', 'on', true);
  update public.applications set coordinator_id = cur
   where user_id = auth.uid() and coordinator_id is null and status in ('draft','revision_required');
  return cur;
end $$;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- pendaftaran baru: koordinator otomatis dari akun
create or replace function public.check_application_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.coordinator_id is not null and not exists (select 1 from public.coordinators where id = new.coordinator_id and is_active) then
    new.coordinator_id := null;
  end if;
  if new.coordinator_id is null then
    select coordinator_id into new.coordinator_id from public.profiles where id = new.user_id;
  end if;
  new.amount := null; new.base_amount := null; new.markup_amount := null;
  return new;
end $$;

-- kirim pendaftaran: pastikan koordinator dari akun terpasang SEBELUM harga dihitung
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'submit_application_core') then
    alter function public.submit_application(uuid) rename to submit_application_core;
  end if;
end $$;
create or replace function public.submit_application(p_id uuid)
returns public.applications language plpgsql security definer set search_path = public as $$
declare pc uuid;
begin
  select coordinator_id into pc from public.profiles where id = auth.uid();
  if pc is not null then
    perform set_config('emki.system', 'on', true);
    update public.applications set coordinator_id = pc
     where id = p_id and user_id = auth.uid() and coordinator_id is null and status in ('draft','revision_required');
  end if;
  return public.submit_application_core(p_id);
end $$;
revoke execute on function public.submit_application_core(uuid) from public, anon, authenticated;
grant execute on function public.submit_application(uuid) to authenticated;
revoke execute on function public.submit_application(uuid) from public, anon;

-- 2. riwayat perubahan oleh admin
create table if not exists public.admin_change_logs (
  id bigint generated always as identity primary key,
  application_id uuid,
  reg_code text, full_name text,
  actor_id uuid references public.profiles(id),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_change_logs_app_idx on public.admin_change_logs (application_id, created_at desc);
alter table public.admin_change_logs enable row level security;
drop policy if exists acl_read on public.admin_change_logs;
drop policy if exists acl_insert on public.admin_change_logs;
create policy acl_read on public.admin_change_logs for select to authenticated using (public.is_admin());
create policy acl_insert on public.admin_change_logs for insert to authenticated with check (public.is_admin() and actor_id = auth.uid());

-- 3. Super Admin: ubah koordinator (+ opsi hitung ulang harga)
create or replace function public.admin_set_coordinator(p_app uuid, p_coordinator uuid, p_reprice boolean default true)
returns public.applications language plpgsql security definer set search_path = public as $$
declare a public.applications; pr record; old_c text; new_c text;
begin
  if not public.is_admin() then raise exception 'Hanya Super Admin'; end if;
  select * into a from public.applications where id = p_app for update;
  if not found then raise exception 'Pendaftaran tidak ditemukan'; end if;
  select code into old_c from public.coordinators where id = a.coordinator_id;
  select code into new_c from public.coordinators where id = p_coordinator;
  if p_coordinator is not null and new_c is null then raise exception 'Koordinator tidak ditemukan'; end if;
  perform set_config('emki.system', 'on', true);
  update public.applications set coordinator_id = p_coordinator, commission_amount = null where id = a.id;
  if p_reprice and a.amount is not null and a.status not in ('paid','cancelled') and a.session_id is not null then
    select * into pr from public.price_for(a.scheme_id, a.session_id, p_coordinator);
    update public.applications set amount = pr.total, base_amount = pr.base, markup_amount = pr.markup where id = a.id;
  end if;
  -- akun peserta ikut ditandai agar pendaftaran berikutnya otomatis tercatat
  update public.profiles set coordinator_id = coalesce(p_coordinator, coordinator_id),
         referred_at = case when p_coordinator is not null then now() else referred_at end
   where id = a.user_id and (coordinator_id is null or p_coordinator is not null);
  select * into a from public.applications where id = p_app;
  insert into public.admin_change_logs (application_id, reg_code, full_name, actor_id, action, detail)
  values (a.id, a.reg_code, a.full_name, auth.uid(), 'ubah_koordinator',
          jsonb_build_object('dari', old_c, 'ke', new_c, 'hitung_ulang_harga', p_reprice, 'harga_baru', a.amount, 'komisi', a.commission_amount));
  return a;
end $$;

-- hitung ulang harga sesuai skema + jadwal + koordinator saat ini
create or replace function public.admin_reprice(p_app uuid)
returns public.applications language plpgsql security definer set search_path = public as $$
declare a public.applications; pr record; old_amt numeric;
begin
  if not public.is_admin() then raise exception 'Hanya Super Admin'; end if;
  select * into a from public.applications where id = p_app for update;
  if a.session_id is null then raise exception 'Peserta belum memilih jadwal'; end if;
  old_amt := a.amount;
  select * into pr from public.price_for(a.scheme_id, a.session_id, a.coordinator_id);
  perform set_config('emki.system', 'on', true);
  update public.applications set amount = pr.total, base_amount = pr.base, markup_amount = pr.markup, commission_amount = null
   where id = a.id returning * into a;
  insert into public.admin_change_logs (application_id, reg_code, full_name, actor_id, action, detail)
  values (a.id, a.reg_code, a.full_name, auth.uid(), 'hitung_ulang_harga', jsonb_build_object('dari', old_amt, 'ke', a.amount));
  return a;
end $$;

-- Super Admin boleh menghapus pendaftaran (beserta pembayarannya)
create or replace function public.admin_delete_application(p_app uuid, p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.applications;
begin
  if not public.is_super_admin() then raise exception 'Hanya Super Admin'; end if;
  select * into a from public.applications where id = p_app;
  if not found then raise exception 'Pendaftaran tidak ditemukan'; end if;
  if upper(trim(coalesce(p_confirm,''))) <> upper(coalesce(a.reg_code, 'HAPUS')) then
    raise exception 'Konfirmasi tidak cocok. Ketik %', coalesce(a.reg_code, 'HAPUS');
  end if;
  insert into public.admin_change_logs (application_id, reg_code, full_name, actor_id, action, detail)
  values (a.id, a.reg_code, a.full_name, auth.uid(), 'hapus_pendaftaran',
          jsonb_build_object('status', a.status, 'skema', (select name from public.schemes where id = a.scheme_id), 'harga', a.amount));
  delete from public.payments where application_id = a.id;
  delete from public.applications where id = a.id;
end $$;

grant execute on function public.admin_set_coordinator(uuid, uuid, boolean), public.admin_reprice(uuid), public.admin_delete_application(uuid, text) to authenticated;
revoke execute on function public.admin_set_coordinator(uuid, uuid, boolean), public.admin_reprice(uuid), public.admin_delete_application(uuid, text) from public, anon;

-- 4. akun peserta yang SUDAH punya pendaftaran berkoordinator → tandai akunnya (data lama)
update public.profiles p set coordinator_id = x.coordinator_id, referred_at = now()
  from (select distinct on (user_id) user_id, coordinator_id from public.applications
         where coordinator_id is not null order by user_id, created_at) x
 where p.id = x.user_id and p.coordinator_id is null;

notify pgrst, 'reload schema';
