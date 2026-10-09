# Update 3.19 — Pusat notifikasi admin (🔔)

Sudah termasuk SEMUA update sebelumnya (3.8–3.18b).

## WAJIB jalankan SQL dulu (Supabase EMKI Training → SQL Editor), yang belum saja:
14, 15, 16, 16b, 17, lalu supabase/18_notifikasi_admin.sql (BARU)

## Fitur
- Ikon 🔔 di menu admin + angka belum dibaca. Klik → 15 notifikasi terbaru, klik item → langsung ke detail pendaftar.
- Halaman Notifikasi: semua kejadian + filter (Verifikasi, Pembayaran, Dokumen, SIAPkerja, Akun baru, Batal).
- Tercatat otomatis: pendaftaran baru, perbaikan dikirim ulang, terima rekomendasi, bukti transfer masuk, lunas,
  kedaluwarsa, peserta batal, upload ulang dokumen, perbaikan SIAPkerja, akun peserta baru.
- Aksi admin sendiri tidak dinotifikasi. Riwayat disimpan 90 hari. Lonceng memperbarui sendiri tiap 1 menit.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-19.zip
git add .
git commit -m "Update 3.19: notifikasi admin"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
