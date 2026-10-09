# Update 3.15 — Contoh capture QR Code SIAPkerja

Sudah termasuk 3.8–3.14b. Tidak ada SQL baru.

- Formulir peserta → Upload dokumen → Capture QR Code akun SIAPkerja: ada panduan + contoh gambar
  (nama, NIK, foto disensor; QR diburamkan sehingga tidak bisa dipindai).

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-15.zip
git add .
git commit -m "Update 3.15: contoh QR SIAPkerja"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
