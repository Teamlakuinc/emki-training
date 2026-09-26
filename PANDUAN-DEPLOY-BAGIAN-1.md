# Panduan Deploy — Bagian 1 (Aplikasi Peserta)
### training.edukasikuliner.com

**Isi Bagian 1:**
- Buat akun + konfirmasi email, masuk, dan lupa password.
- Pilih skema, lalu isi formulir 5 langkah: jadwal & sesi, data diri, akun SIAPkerja, upload dokumen, tinjau & kirim.
- Simpan draft, halaman status, terima rekomendasi skema, dan batalkan pendaftaran.

> **Aturan emas:**
> - **HACCP:** folder `~/emki-haccp-dashboard-21`, port 3000, PM2 `emki-dashboard`.
> - **Training:** folder `~/emki-training`, port 3001, PM2 `emki-training`.
> - Jangan pernah pakai `pm2 restart all`, `pm2 stop all`, atau `pm2 delete all`.

---

## A. Upload kode ke GitHub (di laptop)

1. Extract `emki-training-bagian-1.zip` → kamu dapat folder **emki-training**. Taruh misalnya di **Documents**.
2. Buka **VS Code** → **File → Open Folder** → pilih folder **emki-training**.
3. Menu **Terminal → New Terminal**, lalu jalankan satu per satu:
   ```
   git init
   ```
   ```
   git add .
   ```
   ```
   git commit -m "Bagian 1: aplikasi peserta"
   ```
   ```
   git branch -M main
   ```
   ```
   git remote add origin https://github.com/teamlakuinc/emki-training.git
   ```
   ```
   git push -u origin main
   ```
   Kalau diminta login GitHub, ikuti popup-nya, sama seperti waktu push HACCP.
4. Buka github.com/teamlakuinc/emki-training → pastikan file sudah muncul dan **tidak ada** file `.env.local`.

---

## B. Pasang di VPS

### B1. Masuk & cek cara HACCP terhubung ke GitHub
```
ssh root@187.127.223.225
```
```
cd ~/emki-haccp-dashboard-21
```
```
git remote -v
```
- Kalau hasilnya diawali **`https://github.com/...`** → pakai clone **versi HTTPS** di bawah.
- Kalau diawali **`git@github.com:...`** → pakai **versi SSH**.

### B2. Ambil kode ke folder baru
```
cd ~
```
Versi HTTPS:
```
git clone https://github.com/teamlakuinc/emki-training.git
```
Versi SSH (pilih salah satu saja):
```
git clone git@github.com:teamlakuinc/emki-training.git
```
Kalau diminta username/password: username `teamlakuinc`, password = **Personal Access Token** GitHub (sama dengan yang dipakai untuk HACCP).

Lalu masuk ke folder training:
```
cd ~/emki-training
```

### B3. Buat kunci enkripsi password SIAPkerja
```
openssl rand -base64 32
```
Muncul satu baris acak (sekitar 44 karakter). **Copy**, lalu simpan juga di catatan aman.
> ⚠️ Kunci ini **tidak boleh hilang dan tidak boleh diganti**. Kalau hilang, password SIAPkerja yang sudah tersimpan tidak bisa dibuka lagi.

### B4. Isi file kunci (.env.local)
```
nano .env.local
```
Paste ini, lalu **ganti** tiap nilai:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=isi-anon-key
SUPABASE_SERVICE_ROLE_KEY=isi-service-role-key
SIAPKERJA_ENC_KEY=isi-hasil-openssl-tadi
NEXT_PUBLIC_SITE_URL=https://training.edukasikuliner.com
NEXT_PUBLIC_WA_ADMIN=6285117575842
```
- Tiga nilai pertama diambil dari Supabase project **emki-training** → **Project Settings → API**. **Jangan** pakai kunci project HACCP.
- Simpan dengan **Ctrl+O** → **Enter**, lalu keluar dengan **Ctrl+X**.

Kunci file supaya hanya root yang bisa membaca:
```
chmod 600 .env.local
```

### B5. Install & build
```
npm install
```
```
npm run build
```
Tunggu sampai muncul daftar halaman dan tidak ada tulisan **Failed**.

### B6. Nyalakan dengan PM2 (port 3001)
```
pm2 start npm --name emki-training -- start
```
```
pm2 save
```
```
pm2 list
```
Harus ada **dua baris**, `emki-dashboard` dan `emki-training`, dua-duanya **online**.

Tes dari dalam VPS:
```
curl -I http://localhost:3001/masuk
```
Baris pertama harus `HTTP/1.1 200 OK`.

### B7. Nginx: file BARU untuk training
```
sudo nano /etc/nginx/sites-available/training
```
Paste:
```
server {
    listen 80;
    server_name training.edukasikuliner.com;
    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Simpan dengan **Ctrl+O** → **Enter** → **Ctrl+X**.

Aktifkan:
```
sudo ln -s /etc/nginx/sites-available/training /etc/nginx/sites-enabled/training
```
Tes (WAJIB sebelum reload):
```
sudo nginx -t
```
Harus muncul **syntax is ok** dan **test is successful**. Kalau tidak, **berhenti** dan kirim screenshot.
```
sudo systemctl reload nginx
```

### B8. Pasang HTTPS
```
sudo certbot --nginx -d training.edukasikuliner.com
```
Kalau ditanya soal redirect HTTP ke HTTPS, pilih **Redirect**. Certbot hanya mengurus domain training; sertifikat HACCP tidak disentuh.

### B9. Cek keduanya
- **https://haccp.edukasikuliner.com** → harus tetap normal.
- **https://training.edukasikuliner.com** → muncul daftar 5 skema.

```
exit
```

---

## C. Buat jadwal uji coba (sementara, sampai panel admin di Bagian 2 siap)

Supabase **emki-training** → **SQL Editor** → **New query** → paste → **Run**:
```sql
with j as (
  insert into public.exam_schedules (title, exam_date, tuk, address, status)
  values ('UJI COBA — jangan dipakai', current_date + 14, 'TUK Uji Coba', 'Alamat uji coba', 'open')
  returning id
), x as (
  insert into public.exam_schedule_schemes (schedule_id, scheme_id)
  select j.id, s.id from j, public.schemes s returning 1
)
insert into public.exam_sessions (schedule_id, name, start_time, end_time, quota, sort_order)
select j.id, v.n, v.a::time, v.b::time, 10, v.o
from j, (values ('Sesi 1','08:00','12:00',1), ('Sesi 2','13:00','17:00',2)) v(n,a,b,o);
```
Jadwal ini nanti bisa ditutup atau dihapus dari panel admin (Bagian 2).

## D. Tes sebagai peserta

1. Buka **https://training.edukasikuliner.com/daftar/cook** → **Buat Akun**. Pakai email pribadi, bukan email admin.
2. Cek email → klik link konfirmasi (dikirim dari hi@edukasikuliner.com; cek juga folder Spam).
3. Masuk → klik **Mulai / Lanjutkan Pendaftaran**.
4. Isi 5 langkah. Coba juga **keluar di tengah jalan** lalu masuk lagi: data harus tetap tersimpan sebagai draft.
5. Klik **Kirim pendaftaran** → status harus **Menunggu pembayaran**, dengan nomor **REG-2026-00001**.
6. Ulangi dengan skema lain (misalnya **/daftar/sous-chef**) → status harus **Menunggu verifikasi**.

📸 Kirim screenshot hasil langkah 5 dan 6, dan catat kalau ada bagian yang membingungkan.

> **Jangan dulu** ubah `PLATFORM_LIVE` menjadi `true` di halaman WordPress. Tunggu sampai pembayaran (Bagian 3) selesai.

---

## E. Update kode ke depannya (setiap ada versi baru dariku)

Di laptop, timpa file di folder **emki-training** dengan versi baru, lalu:
```
git add .
```
```
git commit -m "update"
```
```
git push
```
Di VPS:
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

## Kalau ada masalah

Hentikan **hanya** training (HACCP tetap jalan):
```
pm2 stop emki-training
```
Lihat pesan error:
```
pm2 logs emki-training --lines 50
```
Kirim screenshot ke aku. Untuk menyalakan lagi:
```
pm2 start emki-training
```
