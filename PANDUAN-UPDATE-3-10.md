# Update 3.10 — Perbaikan link pendaftaran "Halaman tidak ditemukan"

Sudah termasuk semua isi update 3.8 dan 3.9.

## Yang diperbaiki
1. Peserta yang membuka link dengan akun lain → muncul penjelasan "Pendaftaran ini ada di akun lain" + email akun yang benar (disamarkan) + tombol Keluar & masuk ulang.
2. Admin/verifikator/koordinator yang membuka link peserta → otomatis diarahkan ke halaman kelola pendaftar.
3. Link dari WA yang ikut tanda baca di ujungnya (titik/koma) tetap terbuka.
4. Halaman Masuk: kalau datang dari link pendaftaran, ada pengingat "masuk dengan email yang dulu dipakai, jangan buat akun baru".
5. Admin: detail pendaftar menampilkan "Email akun login". Pesan WA otomatis ditambah "(Masuk dengan email: ...)". Variabel baru di template: {email_akun}.

Tidak ada SQL baru.

## Cara pasang (Mac)
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-10.zip
git add .
git commit -m "Update 3.10: perbaikan link pendaftaran beda akun"
git push

## Di VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
