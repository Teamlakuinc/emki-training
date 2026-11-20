# Update 3.26 — Pelacakan iklan (Google Tag Manager) di platform training

Tidak ada SQL baru. Tidak perlu mengubah file .env.

## Perubahan
- Google Tag Manager (GTM-TJP9F3GB, container yang sama dengan edukasikuliner.com) dipasang di semua halaman training.edukasikuliner.com.
- Event konversi untuk Google Ads & Meta:
  - `sign_up`: peserta berhasil membuat akun.
  - `generate_lead`: pendaftaran berhasil dikirim (skema + nilai rupiah).
  - `purchase`: pendaftaran lunas (nilai rupiah + no. registrasi sebagai transaction_id, supaya tidak dobel).
- Setiap konversi hanya dikirim sekali per pendaftaran per browser, dan hanya untuk pendaftaran yang baru (≤3 hari), jadi peserta lama yang membuka akunnya tidak terhitung.
- Tampilan tidak berubah sama sekali.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-26.zip
git add .
git commit -m "Update 3.26: GTM + event konversi iklan"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
