-- 14. Perbaikan akun SIAPkerja (admin menandai salah → peserta memperbaiki lewat link khusus)
-- Jalankan di Supabase EMKI Training → SQL Editor → Run. Aman dijalankan ulang.

alter table public.applications add column if not exists siapkerja_fix_requested_at timestamptz;
alter table public.applications add column if not exists siapkerja_fix_note text;
alter table public.applications add column if not exists siapkerja_fixed_at timestamptz;

-- password SIAPkerja boleh diganti saat draft/perlu perbaikan, ATAU saat admin meminta perbaikan SIAPkerja
create or replace function public.set_siapkerja_secret(p_application uuid, p_user uuid, p_ciphertext text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.applications where id = p_application and user_id = p_user
                  and (status in ('draft','revision_required') or siapkerja_fix_requested_at is not null)) then
    raise exception 'Pendaftaran tidak dapat diubah';
  end if;
  if p_ciphertext !~ '^v1:' then raise exception 'Format terenkripsi tidak valid'; end if;
  insert into public.application_secrets (application_id, siapkerja_password_enc, set_at)
  values (p_application, p_ciphertext, now())
  on conflict (application_id) do update set siapkerja_password_enc = excluded.siapkerja_password_enc, set_at = now();
end $$;
revoke execute on function public.set_siapkerja_secret(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_siapkerja_secret(uuid, uuid, text) to service_role;

-- template pesan (bisa diedit di menu Template Pesan)
insert into public.message_templates (key, channel, title, body, sort_order) values
('wa_siapkerja_salah','whatsapp','Akun SIAPkerja salah',
'Halo {nama} 🙏

Kami dari EMKI tidak bisa masuk ke akun SIAPkerja Anda untuk pendaftaran sertifikasi {skema}.
Kendala: {catatan_siapkerja}

Mohon cek kembali email, no. telepon, dan password SIAPkerja Anda, lalu perbaiki di link berikut:
{link_siapkerja}

Pastikan Anda bisa login sendiri di siapkerja.kemnaker.go.id dengan data tersebut. Terima kasih 🙏', 90)
on conflict (key) do nothing;

insert into public.message_templates (key, channel, title, subject, body, sort_order) values
('email_siapkerja_salah','email','Akun SIAPkerja salah','Mohon perbaiki data akun SIAPkerja Anda',
'Halo {nama},

Kami dari EMKI tidak bisa masuk ke akun SIAPkerja Anda untuk pendaftaran sertifikasi {skema} ({reg_code}).
Kendala: {catatan_siapkerja}

Mohon cek kembali email, no. telepon, dan password SIAPkerja Anda, lalu perbaiki melalui link berikut:
{link_siapkerja}

Pastikan Anda bisa login sendiri di siapkerja.kemnaker.go.id dengan data tersebut sebelum menyimpan.

Terima kasih,
Tim EMKI', 91)
on conflict (key) do nothing;
