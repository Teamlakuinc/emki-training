# Update 3.3 — Transfer manual, role baru (Verifikator & Koordinator), screenshot Sisfo

## Cara pasang (SQL dulu, baru kode)

### 0. Supabase → SQL Editor
Cek dulu SQL sebelumnya sudah dijalankan (hasil harus `coordinators`):
```sql
select to_regclass('public.coordinators');
```
Kalau `NULL`: jalankan `08_harga_referral.sql` lalu `09_lsp_payout_urutan_sesi.sql` dulu.

Lalu **dua file ini, masing-masing di query terpisah, berurutan**:
1. `supabase/10_tambah_status_role.sql` → **Run** → Success
2. **New query** → `supabase/11_transfer_manual_koordinator.sql` → **Run** → Success

> File 10 harus selesai dulu sebelum 11 (menambah role & status baru).

### 1. Laptop (terminal VS Code)
```bash
cd ~/Downloads/emki-training
```
```bash
unzip -o ~/Downloads/emki-training-update-3-3.zip -d .
```
```bash
git add -A
```
```bash
git commit -m "Update 3.3: transfer manual, role verifikator & koordinator, Sisfo"
```
```bash
git push
```

### 2. VPS
```bash
ssh root@187.127.223.225
```
```bash
cd ~/emki-training
```
```bash
git pull
```
```bash
npm install
```
```bash
npm run build
```
```bash
pm2 restart emki-training
```
```bash
pm2 list
```
Keduanya **online** → `exit`

---

## Setelah terpasang (sekali)

**A. Rekening & metode pembayaran** — Panel Admin → **Pengaturan**
1. Metode: **Transfer manual** → Simpan metode.
2. **Tambah rekening**: bank, nomor rekening, atas nama → Tambah rekening.

**B. Akun koordinator**
1. Koordinator buat akun di **training.edukasikuliner.com/daftar-akun** (email pribadinya) → klik link konfirmasi di email.
2. Panel Admin → **Koordinator** → pastikan datanya ada (kode link, markup / **komisi tetap Rp 100.000**).
3. Panel Admin → **Tim** → email koordinator → role **Koordinator** → pilih data koordinatornya → Simpan.
4. Koordinator login → buka **training.edukasikuliner.com/koordinator** → scan QR Google Authenticator → masuk **Portal Koordinator**.

**C. Verifikator (nanti, kalau sudah ada orangnya)**: sama seperti B, tapi role **Verifikator**.

---

## Tes
1. Daftar sebagai peserta (Cook) lewat link koordinator → kirim → di akun muncul **rekening + form bukti transfer** → upload bukti.
2. Status peserta: **Menunggu konfirmasi pembayaran**, email "Bukti transfer diterima".
3. Panel Admin → **Konfirmasi Pembayaran** → cek gambar bukti → **Konfirmasi lunas** → peserta **Lunas** + email.
4. Portal Koordinator → peserta tadi → **Upload screenshot Sisfo** → di daftar muncul **Sisfo ✓**.
5. Download ZIP peserta → folder berisi **4 lampiran**.
6. Admin → Koordinator → [nama]: komisi Rp 100.000 muncul di "Harus dibayarkan".

## Pembagian akses
| | Super Admin | Verifikator | Koordinator |
|---|---|---|---|
| Verifikasi kelayakan | ✅ | ✅ | ❌ |
| Konfirmasi pembayaran | ✅ | ✅ | ❌ |
| Lihat peserta & dokumen | semua | semua | hanya peserta via link-nya |
| Password SIAPkerja (tercatat, 60 detik) | ✅ | ✅ | pesertanya saja |
| Upload screenshot Sisfo | ✅ | ❌ | pesertanya saja |
| Download ZIP | ✅ | ✅ | pesertanya saja |
| Lihat komisi | semua koordinator | ❌ | miliknya |
| Jadwal, harga, formulir, template, rekening, koordinator, tim | ✅ | ❌ | ❌ |
