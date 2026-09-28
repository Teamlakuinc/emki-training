-- =====================================================================
-- 10_tambah_status_role.sql — jalankan SENDIRI dulu (Run), baru file 11.
-- Menambah role "koordinator" dan status "payment_review" (menunggu konfirmasi pembayaran).
-- =====================================================================
alter type app_role add value if not exists 'koordinator';
alter type application_status add value if not exists 'payment_review' after 'awaiting_payment';
