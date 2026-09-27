# Panduan Update 3.2

**Isi update:**
- Nama lembaga di aplikasi & email menjadi **LSP Rajawali Hospitality Nusantara**.
- **Koordinator**: kotak **"Harus dibayarkan ke koordinator"**, tombol **Tandai sudah dibayarkan**, kolom status per peserta, dan Excel laporan berisi total sudah/harus dibayarkan.
- **Jadwal**: panel **Urutkan sesi berdasarkan skema** (pratinjau → terapkan), otomatis email "Perubahan sesi" ke peserta yang dipindah.

> Kalau Bagian 3 **belum** kamu deploy: jalankan dulu `supabase/08_harga_referral.sql`, isi 8 kunci baru di `.env.local` (lihat PANDUAN-UPDATE-BAGIAN-3.md langkah 1 & 3), baru ikuti panduan ini.

## 0. Database (sekali)
Supabase → **SQL Editor** → **+ New query** → isi file **`supabase/09_lsp_payout_urutan_sesi.sql`** → **Run** → **Success**.

## 1. Laptop → GitHub
Klik dua kali `emki-training-update-3-2.zip` di Downloads (muncul folder **emki-training-update-3-2**). Terminal VS Code (folder **emki-training**):
```
rsync -av ~/Downloads/emki-training-update-3-2/ ~/Downloads/emki-training/
```
```
git add .
```
```
git commit -m "Update 3.2: nama LSP, pembayaran koordinator, urutan sesi"
```
```
git push
```

## 2. VPS
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
```
pm2 restart emki-training
```
```
pm2 list
```
Keduanya **online** → `exit`.

## 3. WordPress (nama LSP di 6 halaman Sertifikasi)
Timpa widget HTML 6 halaman dengan file dari ZIP halaman sertifikasi yang baru (pilih versi **live** atau **belum live**).

## 4. Blog (header disamakan dengan website)
File Manager → **public_html** → upload **blog-upload.zip** → Extract ke `public_html` → pilih **Replace/Overwrite** → hapus ZIP → purge cache.
