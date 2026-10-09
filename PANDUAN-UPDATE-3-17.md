# Update 3.17c — Link bayar tanpa login (per peserta & kolektif) + token huruf kecil

Sudah termasuk SEMUA update sebelumnya (3.8–3.16 + perbaikan "daftar langsung masuk").

## WAJIB jalankan SQL dulu (Supabase EMKI Training → SQL Editor)
1. supabase/14_perbaikan_siapkerja.sql   (kalau belum)
2. supabase/15_batas_bayar_sebelum_ujikom.sql   (kalau belum)
3. supabase/16_link_bayar_tanpa_login.sql   (BARU)
4. supabase/16b_token_huruf_kecil.sql   (BARU)

## Fitur
- Detail pendaftar → Perpanjang batas bayar: pilih +2 / +6 / +12 / +24 / +72 jam atau isi jumlah jam sendiri.
- Detail pendaftar (status Menunggu pembayaran) → kartu "Link bayar tanpa login":
  salin link, kirim WA ke peserta, atau kirim ke nomor WA pihak yang membayari.
- Menu baru "Bayar Kolektif": centang beberapa peserta → isi data pembayar → "Buat link tagihan".
  Pembayar bayar SEKALI → semua peserta di tagihan otomatis Lunas + dapat email lunas.
- Halaman publik /bayar/... : tanpa login, tampil nama, skema, jadwal, total, tombol Bayar (DOKU), cek status.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-17.zip
git add .
git commit -m "Update 3.17: link bayar tanpa login + bayar kolektif"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
