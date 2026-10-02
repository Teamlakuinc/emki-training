-- =====================================================================
-- 13_wa_akun_cek_harga.sql — jalankan SETELAH 12.
--  1. Nomor WhatsApp disimpan saat membuat akun, otomatis terisi di pendaftaran
--  2. Pengecekan harga otomatis (tagihan yang tidak sesuai skema/jadwal/koordinator)
--  3. Template WA untuk mengingatkan pendaftaran yang belum selesai
-- =====================================================================

-- 1. WA saat buat akun
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select id into c from public.coordinators
   where code = upper(trim(coalesce(new.raw_user_meta_data->>'ref',''))) and is_active;
  insert into public.profiles (id, email, full_name, phone_wa, coordinator_id, referred_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''),
          nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'phone',''), '[^0-9+]', '', 'g'), ''),
          c, case when c is not null then now() end)
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.check_application_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if new.coordinator_id is not null and not exists (select 1 from public.coordinators where id = new.coordinator_id and is_active) then
    new.coordinator_id := null;
  end if;
  select * into p from public.profiles where id = new.user_id;
  if new.coordinator_id is null then new.coordinator_id := p.coordinator_id; end if;
  if new.phone is null then new.phone := p.phone_wa; end if;
  new.amount := null; new.base_amount := null; new.markup_amount := null;
  return new;
end $$;

-- 2. Tagihan yang tidak sesuai harga yang seharusnya (belum bayar)
create or replace function public.admin_price_mismatches()
returns table (application_id uuid, reg_code text, full_name text, koordinator text, status application_status, ditagihkan numeric, seharusnya numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Hanya staf'; end if;
  return query
  select a.id, a.reg_code, a.full_name, c.code, a.status, a.amount, p.total
    from public.applications a
    left join public.coordinators c on c.id = a.coordinator_id
    cross join lateral public.price_for(a.scheme_id, a.session_id, a.coordinator_id) p
   where a.status in ('submitted','revision_required','recommended','awaiting_payment')
     and a.session_id is not null and a.amount is not null
     and a.amount is distinct from p.total
   order by a.submitted_at;
end $$;

-- Sesuaikan semua sekaligus (Super Admin)
create or replace function public.admin_reprice_all()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not public.is_admin() then raise exception 'Hanya Super Admin'; end if;
  for r in select application_id from public.admin_price_mismatches() loop
    perform public.admin_reprice(r.application_id); n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.admin_price_mismatches(), public.admin_reprice_all() to authenticated;
revoke execute on function public.admin_price_mismatches(), public.admin_reprice_all() from public, anon;

-- 3. Template WA pengingat
insert into public.message_templates (key, channel, title, body, sort_order) values
('wa_lanjutkan_daftar','whatsapp','Ingatkan lanjutkan pendaftaran',
'Halo {nama}, terima kasih sudah membuat akun di EMKI 🙏

Pendaftaran Sertifikasi BNSP Anda belum selesai. Lanjutkan di sini (data yang sudah diisi tetap tersimpan):
{link}

Jika ada kendala, balas pesan ini ya. Tim EMKI', 0)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
