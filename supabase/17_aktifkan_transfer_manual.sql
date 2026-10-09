-- 17. Aktifkan lagi transfer manual (DOKU tetap jalan) + rekening BCA
-- Jalankan di Supabase EMKI Training → SQL Editor → Run. Aman dijalankan ulang.

-- metode pembayaran: 'both' = peserta memilih DOKU atau transfer manual
-- (bisa diganti kapan saja di Panel Admin → Pengaturan)
insert into public.app_settings (key, value, updated_at) values ('payment_method', '"both"', now())
on conflict (key) do update set value = '"both"', updated_at = now();

-- rekening BCA (hanya ditambahkan kalau belum ada)
insert into public.bank_accounts (bank, account_number, account_name, is_active, sort_order)
select 'BCA', '1720318888', 'Yay Edukasi Mandiri Kuliner Indonesia', true, 1
where not exists (select 1 from public.bank_accounts where account_number = '1720318888');
update public.bank_accounts set is_active = true where account_number = '1720318888';

select bank, account_number, account_name, is_active from public.bank_accounts order by sort_order;
