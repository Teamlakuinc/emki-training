# Update 3.12 — Tombol "Akun SIAPkerja salah" + link perbaikan untuk peserta

Sudah termasuk isi 3.8–3.11. WAJIB jalankan SQL 14 dulu.

## Fitur
- Detail pendaftar → kartu "Akun SIAPkerja" → tombol "⚠️ Akun SIAPkerja salah / tidak bisa diakses".
- Pilih kendala (password salah, email tidak terdaftar, dst.) → klik "Tandai & kirim link perbaikan":
  WA terbuka berisi link perbaikan + email otomatis terkirim ke peserta.
- Peserta membuka link → isi ulang email, no. telepon, password SIAPkerja → simpan.
  Bisa dipakai walaupun peserta sudah bayar.
- Admin melihat status "Menunggu perbaikan" / "Peserta memperbarui pada ...". Ada tombol kirim ulang pengingat dan "Sudah beres".
- Template pesan bisa diedit di menu Template Pesan (Akun SIAPkerja salah).

## Langkah 1 — SQL
Supabase project EMKI Training → SQL Editor → New query → tempel isi supabase/14_perbaikan_siapkerja.sql → Run.

## Langkah 2 — Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-12.zip
git add .
git commit -m "Update 3.12: perbaikan akun SIAPkerja"
git push

## Langkah 3 — VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
