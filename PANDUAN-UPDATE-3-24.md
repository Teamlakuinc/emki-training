# Update 3.24 — Tab status, urutan fleksibel & pencarian di daftar Pendaftar

Tidak ada SQL baru.

## Perubahan
- Halaman **Pendaftar**: tab per status dengan jumlahnya — Semua, Menunggu verifikasi, Perlu perbaikan, Rekomendasi skema,
  Menunggu pembayaran, Konfirmasi pembayaran, Lunas | Belum ada hasil Ujikom, Kompeten, Sertifikat belum diupload,
  Belum Kompeten | Lewat batas bayar, Ditolak, Dibatalkan, Draft.
- **Pencarian langsung** (tanpa klik Tampilkan): nama, NIK, no. reg, no. WA (08… / 62… sama saja), email, skema, koordinator, TUK.
  Beberapa kata = semua harus cocok, contoh: `chef kahfri`.
- **Urutkan**: klik judul kolom (▲/▼), atau pilih dari dropdown: tanggal daftar, nama, skema, status, jadwal Ujikom,
  koordinator, pengalaman, harga, tanggal lunas, batas bayar, tanggal hasil Ujikom, Sisfo, sertifikat BNSP, no. reg.
- Filter skema & koordinator tetap ada; jumlah di tab ikut berubah sesuai filter/pencarian.
- Pilihan tab/cari/urutan tersimpan di alamat halaman, jadi tetap sama saat kembali dari detail peserta.
- Centangan otomatis dilepas untuk peserta yang tidak lagi terlihat, supaya tidak ikut ter-download/ditandai.
- Halaman Jadwal (daftar peserta per sesi) juga bisa diurutkan lewat klik judul kolom.

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-24.zip
git add .
git commit -m "Update 3.24: tab status, urutan & pencarian pendaftar"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
