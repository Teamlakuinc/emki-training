# Update 3.16 — Email konfirmasi tidak masuk

Sudah termasuk 3.8–3.15. Tidak ada SQL baru.

- Panel Admin → Akun Peserta: tanda "Belum konfirmasi email" + tombol "✓ Aktifkan" (per akun / semua sekaligus).
- Halaman "Cek email Anda": tombol "Kirim ulang email" + tombol WhatsApp ke admin.
- Kalau "Confirm email" di Supabase dimatikan: pendaftar langsung masuk & lanjut isi formulir tanpa menunggu email.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-16.zip
git add .
git commit -m "Update 3.16: aktifkan akun + kirim ulang email"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
