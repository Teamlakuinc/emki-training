# Update 3.13 — Batalkan persetujuan + contoh pas foto

Sudah termasuk 3.8–3.12. Tidak ada SQL baru (SQL 14 dari 3.12 tetap wajib sudah dijalankan).

## Fitur
1. Detail pendaftar berstatus "Menunggu pembayaran" → kartu "Salah setujui?":
   tulis catatan → "Batalkan persetujuan & minta perbaikan".
   Status kembali ke "Perlu perbaikan", batas bayar dihapus, peserta dapat email revisi.
   Diblokir otomatis kalau peserta sudah bayar (pakai tombol Ganti di kartu Dokumen).
2. Formulir peserta → langkah Upload dokumen → Pas foto: ada panduan + gambar contoh BENAR & SALAH.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-13.zip
git add .
git commit -m "Update 3.13: batalkan persetujuan + contoh pas foto"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
