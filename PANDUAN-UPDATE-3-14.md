# Update 3.14 — Admin lebih fleksibel

Sudah termasuk 3.8–3.13. Tidak ada SQL baru (SQL 14 tetap wajib sudah dijalankan).

## Fitur baru di detail pendaftar (Admin / Super Admin)
1. Edit data peserta: form rapi berbahasa Indonesia (pilihan jenis kelamin, provinsi, pendidikan, kalender tanggal lahir),
   termasuk pertanyaan tambahan dan password SIAPkerja baru. Kolom yang diubah ditandai kuning.
   Riwayat mencatat data lama → data baru.
2. Batas bayar: atur ke tanggal & jam tertentu (status Kedaluwarsa otomatis aktif lagi).
3. Akun login: lihat email login, kirim link reset password, pindahkan pendaftaran ke akun lain.
4. Dokumen: lihat versi sebelumnya dan "Pakai versi ini" untuk mengembalikan dokumen lama.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-14.zip
git add .
git commit -m "Update 3.14: admin lebih fleksibel"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
