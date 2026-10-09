# Update 3.20 — Upload bukti transfer di link bayar tanpa login

Sudah termasuk SEMUA update sebelumnya (3.8–3.19).

## WAJIB jalankan SQL dulu (Supabase EMKI Training → SQL Editor), yang belum saja:
14, 15, 16, 16b, 17, 18, lalu supabase/19_bukti_transfer_tanpa_login.sql (BARU)

## Fitur
- Link bayar per peserta: di bawah rekening BCA ada form "Sudah transfer? Upload bukti di sini"
  (nama pengirim, bank, tanggal, file JPG/PNG/PDF). Status → "Menunggu konfirmasi pembayaran".
- Link bayar kolektif: sekali upload bukti untuk semua peserta di tagihan.
- Admin → Konfirmasi Pembayaran: bukti kolektif tampil 1 kartu; "Konfirmasi lunas" = semua peserta di transfer itu Lunas.
- Notifikasi 🔔 "Bukti transfer masuk" otomatis muncul.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-20.zip
git add .
git commit -m "Update 3.20: upload bukti transfer tanpa login"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
