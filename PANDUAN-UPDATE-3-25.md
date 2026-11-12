# Update 3.25 — Status kembali dropdown + pencarian langsung & urutan fleksibel

Sudah termasuk update 3.24 (kalau 3.24 belum dideploy, cukup pakai zip ini). Tidak ada SQL baru.

## Perubahan
- Halaman **Pendaftar**: Status kembali berupa **dropdown** seperti dulu, sekarang dengan jumlah per status — Semua, Menunggu verifikasi, Perlu perbaikan, Rekomendasi skema,
  Menunggu pembayaran, Konfirmasi pembayaran, Lunas | Belum ada hasil Ujikom, Kompeten, Sertifikat belum diupload,
  Belum Kompeten | Lewat batas bayar, Ditolak, Dibatalkan, Draft.
- **Pencarian langsung** (tanpa klik Tampilkan): nama, NIK, no. reg, no. WA (08… / 62… sama saja), email, skema, koordinator, TUK.
  Beberapa kata = semua harus cocok, contoh: `chef kahfri`.
- **Urutkan**: klik judul kolom (▲/▼), atau pilih dari dropdown: tanggal daftar, nama, skema, status, jadwal Ujikom,
  koordinator, pengalaman, harga, tanggal lunas, batas bayar, tanggal hasil Ujikom, Sisfo, sertifikat BNSP, no. reg.
- Filter skema & koordinator tetap ada; jumlah di dropdown Status ikut berubah sesuai filter/pencarian.
- Pilihan status/cari/urutan tersimpan di alamat halaman, jadi tetap sama saat kembali dari detail peserta.
- Centangan otomatis dilepas untuk peserta yang tidak lagi terlihat, supaya tidak ikut ter-download/ditandai.
- Halaman Jadwal (daftar peserta per sesi) juga bisa diurutkan lewat klik judul kolom.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-25.zip
git add .
git commit -m "Update 3.25: status dropdown + cari & urutkan pendaftar"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
