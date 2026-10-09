# Update 3.18 — Transfer manual BCA aktif lagi (DOKU tetap jalan)

Sudah termasuk SEMUA update sebelumnya (3.8–3.17c).

## WAJIB jalankan SQL dulu (Supabase EMKI Training → SQL Editor), yang belum saja:
- supabase/14_perbaikan_siapkerja.sql
- supabase/15_batas_bayar_sebelum_ujikom.sql
- supabase/16_link_bayar_tanpa_login.sql
- supabase/16b_token_huruf_kecil.sql
- supabase/17_aktifkan_transfer_manual.sql   (BARU)

## Fitur
- Panel Admin → Pengaturan: pilih metode pembayaran: DOKU saja / Transfer manual saja / Keduanya. Kelola rekening.
- Peserta (mode Keduanya): pilih "Bayar online" (DOKU) atau "Transfer manual" (rekening BCA + upload bukti).
- Bukti transfer masuk ke menu "Konfirmasi Pembayaran" → klik Konfirmasi → status Lunas + email.
- Link bayar tanpa login (per peserta & kolektif) juga menampilkan rekening BCA + tombol kirim bukti via WA.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-18.zip
git add .
git commit -m "Update 3.18: transfer manual aktif lagi"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
