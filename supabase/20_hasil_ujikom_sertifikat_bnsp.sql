-- =====================================================================
-- 20 — Hasil Ujikom (Kompeten / Belum Kompeten) + upload & link unduh sertifikat BNSP
-- Jalankan di Supabase "EMKI Training" → SQL Editor → Run. Aman diulang.
-- =====================================================================
alter table public.applications add column if not exists exam_done_at timestamptz;
alter table public.applications add column if not exists cert_token text;
create unique index if not exists applications_cert_token_key on public.applications (cert_token) where cert_token is not null;

-- dokumen yang diupload tim: Sertifikat BNSP
insert into public.required_documents (code, name, description, accept, is_required, filled_by, is_active, sort_order)
values ('sertifikat_bnsp', 'Sertifikat BNSP', 'Diupload admin setelah sertifikat BNSP terbit. Peserta mengunduh lewat link yang dikirim via WhatsApp.', 'image_pdf', false, 'staff', true, 95)
on conflict (code) do nothing;

-- template WA: kirim link unduh sertifikat
insert into public.message_templates (key, channel, title, subject, body, sort_order) values
('wa_sertifikat_bnsp', 'whatsapp', 'Sertifikat BNSP siap diunduh', null,
'Halo {nama} 👋

Selamat! Anda dinyatakan *KOMPETEN* pada Uji Kompetensi BNSP skema *{skema}*. 🎉

Sertifikat BNSP Anda sudah bisa diunduh di link berikut:
{link_sertifikat}

Simpan baik-baik ya. Terima kasih sudah mengikuti sertifikasi bersama EMKI.

Tim EMKI', 60)
on conflict (key) do nothing;

notify pgrst, 'reload schema';

-- data lama yang sudah punya hasil Ujikom: beri tanggal & token link
update public.applications set exam_done_at = coalesce(exam_done_at, now()), cert_token = coalesce(cert_token, substr(md5(gen_random_uuid()::text), 1, 20)) where exam_result is not null;

-- sertifikat BNSP hanya boleh diupload admin (bukan koordinator)
drop policy if exists doc_insert_staff on public.application_documents;
create policy doc_insert_staff on public.application_documents for insert to authenticated
  with check ((public.is_admin() or (public.is_coordinator_of(application_id) and doc_type <> 'sertifikat_bnsp'))
              and exists (select 1 from public.required_documents d where d.code = doc_type and d.filled_by = 'staff'));
drop policy if exists "dok: upload tim" on storage.objects;
create policy "dok: upload tim" on storage.objects for insert to authenticated
  with check (bucket_id = 'application-documents' and (storage.filename(name)) like 'tim-%'
    and (public.is_admin() or (public.is_coordinator_of(((storage.foldername(name))[2])::uuid) and (storage.filename(name)) not like 'tim-sertifikat_bnsp-%')));
