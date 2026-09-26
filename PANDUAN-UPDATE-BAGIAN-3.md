# Panduan Update — Bagian 3 (Pembayaran, Email, Harga per Lokasi, Referral)

**Isi Bagian 3:**
- **Pembayaran Midtrans**: tombol **Bayar sekarang** di akun peserta (VA, QRIS, e-wallet, dll.), status **Lunas otomatis** lewat notifikasi Midtrans, plus tombol "Cek status pembayaran".
- **Email otomatis** dari hi@edukasikuliner.com: pendaftaran diterima, siap bayar, perlu perbaikan, rekomendasi skema, ditolak, pembayaran diterima, dan email jadwal massal (tombol di halaman jadwal). Isi email bisa diubah di menu **Template Pesan**.
- **Harga per jadwal per skema**: di pengaturan jadwal ada tabel harga khusus (mis. Bandung lebih mahal).
- **Koordinator & link referral** `/r/KODE`: markup rupiah atau persen, bisa beda per skema. Peserta referral hanya melihat harga markup. Laporan + download Excel per koordinator.
- **Halaman WordPress v3**: harga tidak lagi ditampilkan, diganti tombol **Lihat Jadwal & Harga**.

---

## 0. Tambahan database (sekali)
Supabase → **EMKI Training** → **SQL Editor** → **+ New query** → isi file **`supabase/08_harga_referral.sql`** → **Run** → **Success**.

## 1. Siapkan Midtrans (Sandbox)
1. Login **dashboard.midtrans.com** → pastikan mode **Sandbox** (pojok kiri atas).
2. **Settings → Access Keys** → catat **Server Key** dan **Client Key** (jangan dikirim ke chat).
3. **Settings → Payment** (atau **Configuration**) → isi:
   - **Payment Notification URL**: `https://training.edukasikuliner.com/api/midtrans/notification`
   - **Finish / Unfinish / Error Redirect URL**: `https://training.edukasikuliner.com/akun`
   → **Save / Update**.

## 2. Kode di laptop → GitHub
Download & klik dua kali `emki-training-bagian-3.zip` (muncul folder **emki-training-bagian-3** di Downloads). Di VS Code (folder **emki-training**), terminal:
```
rsync -av ~/Downloads/emki-training-bagian-3/ ~/Downloads/emki-training/
```
```
git add .
```
```
git commit -m "Bagian 3: pembayaran, email, harga lokasi, referral"
```
```
git push
```

## 3. VPS: tambah kunci baru ke `.env.local` (SEBELUM build)
```
ssh root@187.127.223.225
```
```
cd ~/emki-training
```
```
nano .env.local
```
Di editor: tekan **panah bawah** sampai kursor di **baris kosong paling bawah** (setelah `NEXT_PUBLIC_WA_ADMIN=...`). Siapkan dulu 8 baris ini di **Notes**, isi nilainya, lalu paste:
```
MIDTRANS_SERVER_KEY=isi-server-key-sandbox
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=isi-client-key-sandbox
MIDTRANS_IS_PRODUCTION=false
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=hi@edukasikuliner.com
SMTP_PASS=isi-password-email-hi@edukasikuliner.com
SMTP_FROM="EMKI Sertifikasi <hi@edukasikuliner.com>"
```
Simpan: **Ctrl+O → Enter → Ctrl+X**.

Cek (hanya nama, aman di-screenshot):
```
cut -d= -f1 .env.local
```
Harus ada **14 nama**: 6 yang lama + 8 yang baru.

## 4. VPS: update & build
```
git pull
```
```
npm install
```
```
npm run build
```
```
pm2 restart emki-training
```
```
pm2 list
```
Keduanya **online** → `exit`.

## 5. WordPress: timpa 6 halaman Sertifikasi (v3, tanpa harga)
Pakai file dari **emki-halaman-sertifikasi-v3.zip**, caranya sama seperti sebelumnya (Edit with Elementor → widget HTML → kosongkan → paste → Update). `PLATFORM_LIVE` biarkan **false** dulu.

---

## 6. Tes
1. **Jadwal** → buka jadwal tes → tabel **Harga di jadwal ini** → isi harga khusus Cook (mis. `2300000`) → Simpan → cek training.edukasikuliner.com/daftar/cook: sesi jadwal itu menampilkan harga baru.
2. **Koordinator** → buat koordinator `TES`, markup default `+10%` → buka link `training.edukasikuliner.com/r/TES` di **Incognito** → harga yang tampil sudah naik 10%.
3. Masih di Incognito: buat akun peserta baru → daftar Cook → isi sampai **Kirim** → cek email: **Pendaftaran siap dibayar**.
4. Klik **Bayar sekarang** → pilih misalnya **BCA Virtual Account** → salin nomor VA.
5. Buka **simulator.sandbox.midtrans.com** → pilih **BCA Virtual Account** → tempel nomor VA → **Inquire → Pay**.
6. Kembali ke akun peserta → dalam beberapa detik status jadi **Lunas** (atau klik **Cek status pembayaran**) + email **Pembayaran diterima** masuk.
7. Panel admin → **Koordinator → TES**: peserta muncul dengan markup-nya → **Download laporan Excel**.

📸 Kirim screenshot kalau ada yang error.

---

## Sebelum go-live (setelah semua tes lancar) — kabari aku dulu
1. **Ganti kunci Supabase** (JWT secret) & isi ulang anon/service key di `.env.local` — karena kunci lama sempat terlihat.
2. **Midtrans Production**: setelah akun disetujui, ganti `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION=true`, isi Notification URL di mode **Production**, lalu build ulang.
3. **Bersihkan data uji coba**.
4. Ubah `PLATFORM_LIVE: true` di 6 halaman WordPress.
Aku akan kirim langkah detail untuk keempatnya.
