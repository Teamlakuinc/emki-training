# Update 3.11 — Admin bisa upload/ganti dokumen peserta

Sudah termasuk isi 3.8, 3.9, 3.10. Tidak ada SQL baru.

## Fitur
- Panel Admin → detail pendaftar → kartu "Dokumen": setiap dokumen punya tombol Upload/Ganti.
- Bisa dipakai Super Admin, Admin, dan Verifikator.
- Versi lama tetap tersimpan (v1, v2, ...). Setiap upload tercatat di "Riwayat perubahan".
- Peserta langsung melihat dokumen versi terbaru di akunnya.
- Kalau status "Perlu perbaikan": ada tombol "Kirim ke antrean verifikasi" supaya bisa langsung disetujui.

## Cara pasang (Mac)
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-11.zip
git add .
git commit -m "Update 3.11: admin upload dokumen peserta"
git push

## Di VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
