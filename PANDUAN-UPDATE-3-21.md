# Update 3.21 — Admin upload bukti bayar & tandai Lunas

Sudah termasuk SEMUA update sebelumnya (3.8–3.20). Tidak ada SQL baru
(tapi SQL 14–19 harus sudah dijalankan).

## Fitur
- Detail pendaftar (Menunggu pembayaran / Kedaluwarsa / Menunggu konfirmasi) → kartu "Catat pembayaran manual":
  upload bukti + nama pengirim, bank, tanggal → peserta langsung LUNAS, bukti tersimpan, email lunas terkirim.
- Bayar Kolektif → tiap tagihan yang belum lunas punya tombol "Upload bukti & tandai lunas" → semua peserta di tagihan Lunas.
- Tercatat di riwayat perubahan & notifikasi.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-21.zip
git add .
git commit -m "Update 3.21: admin upload bukti bayar"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
