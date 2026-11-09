# Update 3.23 — Hasil Ujikom (Kompeten / Belum Kompeten) + kirim sertifikat BNSP

Sudah termasuk SEMUA update sebelumnya (3.8–3.22).
SQL 20 (supabase/20_hasil_ujikom_sertifikat_bnsp.sql) SUDAH dijalankan langsung di Supabase — tidak perlu dijalankan lagi.

## Perubahan
- Daftar Pendaftar & halaman Jadwal: centang peserta Lunas → **✅ Tandai Kompeten** / **Belum Kompeten** / ↺ Batalkan hasil.
  Tombol "Pilih yang belum ada hasil" untuk memilih semua yang sudah Lunas tapi belum diisi hasilnya.
- Status baru tampil: **Selesai · Kompeten** (hijau) dan **Selesai · Belum Kompeten** (kuning) — di admin, koordinator, dan akun peserta.
- Filter Status baru: Lunas · belum ada hasil Ujikom / Selesai · Kompeten / Kompeten · sertifikat belum diupload / Selesai · Belum Kompeten.
- Kolom baru **Sert. BNSP** (✓ ada / belum upload).
- Detail peserta: kartu **Hasil Ujikom & sertifikat BNSP** → upload sertifikat (PDF/JPG/PNG), salin link, **💬 Kirim link sertifikat via WA**.
- Peserta membuka link `/sertifikat-bnsp/<kode>` tanpa login → tombol **Unduh sertifikat**. Juga ada tombol "🎓 Sertifikat BNSP" di Akun Saya.
- Template WA baru: "Sertifikat BNSP siap diunduh" (bisa diubah di menu Template Pesan).
- Keamanan: sertifikat BNSP hanya bisa diupload admin (koordinator tidak bisa).

## Mac
cd ~/Downloads/emki-training
unzip -o ~/Downloads/emki-training-update-3-23.zip
git add .
git commit -m "Update 3.23: hasil Ujikom + sertifikat BNSP"
git push

## VPS
ssh root@187.127.223.225
cd ~/emki-training
git pull
npm install
npm run build
pm2 restart emki-training
