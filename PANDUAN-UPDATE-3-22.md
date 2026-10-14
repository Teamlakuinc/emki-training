# Update 3.22 — Tampilan panel admin: menu bawah (HP) + sidebar (laptop)

Sudah termasuk SEMUA update sebelumnya (3.8–3.21). Tidak ada SQL baru.

## Perubahan
- HP: bar atas tipis (judul halaman + lonceng), tab bar bawah: Beranda · Verifikasi · Bayar · Peserta · Lainnya.
  Angka merah = jumlah yang menunggu verifikasi / bukti bayar. "Lainnya" membuka panel menu dari bawah.
- Laptop: menu pindah ke sidebar kiri, menu aktif disorot biru.
- Panel lonceng: tidak terpotong lagi di HP (selebar layar) + tombol ✕.
- Portal koordinator: menu tidak bertumpuk di HP.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-22.zip
git add .
git commit -m "Update 3.22: menu bawah HP + sidebar admin"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
