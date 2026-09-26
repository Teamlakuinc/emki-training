# Panduan Update — Bagian 2 (Panel Admin & Verifikator)

**Isi Bagian 2** (alamat: **training.edukasikuliner.com/admin**):
- Login admin dengan **verifikasi 2 langkah** (Google Authenticator).
- **Dashboard**: jumlah menunggu verifikasi, menunggu bayar, lunas, dll.
- **Verifikasi**: Setujui / Minta perbaikan / Rekomendasikan skema lain / Tolak, dengan catatan.
- **Pendaftar**: cari & filter, **centang peserta → Download** (Excel + 1 folder dokumen per peserta), tombol **WhatsApp** dengan template.
- **Jadwal Ujikom**: buat jadwal, pilih skema, tambah sesi & kuota, buka/tutup jadwal, lihat peserta per sesi.
- **Detail peserta**: data lengkap, buka dokumen, pindah sesi, perpanjang batas bayar, **tampilkan password SIAPkerja** (admin saja, tercatat), hasil Ujikom, catatan internal.
- **Template Pesan**: ubah/tambah isi pesan WhatsApp sendiri.
- **Skema & Harga**: ubah harga, atur perlu verifikasi/langsung bayar, aktif/nonaktif, tambah skema baru. Harga di halaman WordPress ikut berubah otomatis.
- **Formulir**: atur dokumen upload (nama, format, wajib/opsional, skema mana) dan buat pertanyaan tambahan sendiri.
- **Tim**: tambahkan verifikator/admin (khusus Super Admin).

---

## 0. Tambahan database (WAJIB, sekali saja, sebelum update kode)

1. Supabase → project **EMKI Training** → **SQL Editor** → **+ New query**.
2. Buka file **`supabase/07_formulir_harga.sql`** (ada di dalam folder ZIP ini) dengan TextEdit → **Cmd+A** → **Cmd+C**.
3. Paste di SQL Editor → **Run** → harus **Success**.

## A. Timpa kode di laptop

1. Download `emki-training-bagian-2.zip` → klik dua kali di **Downloads** → muncul folder **`emki-training-bagian-2`**.
   > Jangan hapus/ganti folder **`emki-training`** yang lama (di situ ada catatan git).
2. Buka **VS Code** dengan folder **emki-training** (File → Open Folder → Downloads → emki-training).
3. **Terminal → New Terminal**. Pastikan baris terakhir diakhiri `emki-training %`.
4. Salin file baru ke folder lama (satu perintah):
   ```
   rsync -av ~/Downloads/emki-training-bagian-2/ ~/Downloads/emki-training/
   ```
   Muncul daftar file yang disalin, diakhiri `total size is ...`.
5. Kirim ke GitHub:
   ```
   git add .
   ```
   ```
   git commit -m "Bagian 2: panel admin & verifikator"
   ```
   ```
   git push
   ```
   Berhasil kalau diakhiri `main -> main`.

## B. Update di VPS

```
ssh root@187.127.223.225
```
```
cd ~/emki-training
```
```
git pull
```
```
npm install
```
```
npm run build
```
Tunggu sampai muncul tabel daftar halaman (ada `/admin`, `/admin/jadwal`, dll.) tanpa tulisan **Failed**.
```
pm2 restart emki-training
```
```
pm2 list
```
`emki-training` harus **online** (dan `emki-dashboard` tetap online).
```
exit
```

---

## C. Masuk panel admin pertama kali

1. Buka **https://training.edukasikuliner.com/masuk** → login dengan **akun Super Admin** (yang dibuat di Supabase waktu setup database).
2. Buka **https://training.edukasikuliner.com/admin**.
3. Muncul halaman **Verifikasi 2 langkah** dengan QR code:
   1. Install **Google Authenticator** di HP (App Store / Play Store).
   2. Buka aplikasinya → **+** → **Scan QR code** → arahkan ke QR di layar.
   3. Ketik **6 angka** yang muncul di aplikasi → **Verifikasi**.
4. Masuk ke Dashboard. Mulai sekarang, setiap login ke panel admin cukup masukkan 6 angka dari aplikasi.

> Simpan HP dengan baik. Kalau HP hilang/ganti, kabari aku untuk reset verifikasi 2 langkah akun tersebut.

## D. Tes fitur

1. **Jadwal Ujikom → Buat jadwal baru** → isi judul, tanggal, TUK, centang skema, status **Dibuka** → **Buat jadwal** → tambahkan **Sesi 1** dan **Sesi 2** dengan kuotanya.
2. Jadwal **UJI COBA** yang lama: buka → Pengaturan jadwal → status **Selesai** → Simpan (supaya tidak muncul lagi ke peserta).
3. **Verifikasi** → buka pendaftar **Sous Chef** yang tadi → coba **Rekomendasi skema** ke Demi Chef dengan catatan → **Simpan keputusan** → klik tombol WA **Rekomendasi skema**.
4. Login sebagai peserta tadi (browser lain / incognito) → buka pendaftarannya → **Terima rekomendasi** → status jadi **Menunggu pembayaran** dengan harga Demi Chef.
5. **Pendaftar** → filter status **Semua** → centang 1–2 peserta → **Download yang dicentang** → buka ZIP-nya: ada `Data Peserta.xlsx` + folder `01 - NAMA`, `02 - NAMA` berisi dokumen.
   > Status **Lunas** baru bisa dites setelah Bagian 3 (Midtrans). Untuk sementara pakai filter "Semua".
6. **Skema & Harga** → ubah harga salah satu skema → Simpan → buka training.edukasikuliner.com: harga ikut berubah.
7. **Formulir** → tambah pertanyaan, misalnya "Ukuran baju" (Pilihan: S, M, L, XL) → login sebagai peserta → pertanyaan muncul di langkah Data diri.
8. **Tim** → masukkan email verifikator (orangnya buat akun dulu di halaman Buat Akun) → role **Verifikator**.

📸 Kirim screenshot kalau ada yang error atau terasa membingungkan.


---

## E. Update 6 halaman Sertifikasi di WordPress (sekali saja)

Supaya harga di WordPress **otomatis mengikuti** panel admin, isi widget HTML di 6 halaman perlu ditimpa dengan versi baru (file ada di ZIP **emki-halaman-sertifikasi-v2.zip**):

| Halaman WordPress | File |
|---|---|
| Sertifikasi | `00-sertifikasi.html` |
| Cook | `01-cook.html` |
| Demi Chef | `02-demi-chef.html` |
| Chef de Partie | `03-chef-de-partie.html` |
| Sous Chef | `04-sous-chef.html` |
| Executive Chef | `05-executive-chef.html` |

Untuk tiap halaman: **Edit with Elementor** → klik widget HTML → kosongkan kotak **HTML Code** (Cmd+A → Delete) → buka file dengan TextEdit → Cmd+A → Cmd+C → paste → **Update**.

> Kalau sebelumnya kamu sudah mengisi `var HERO_IMG = "..."` (foto hero) di halaman skema, isi ulang baris itu setelah menempel versi baru.
> `PLATFORM_LIVE` tetap **false** sampai Bagian 3 selesai.
