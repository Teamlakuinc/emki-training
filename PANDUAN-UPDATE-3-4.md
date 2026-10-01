# Update 3.4 — Referral terkunci ke akun + Kelola peserta (Super Admin)

0. Supabase **EMKI Training** → SQL Editor → New query → isi `supabase/12_referral_akun_superadmin.sql` → Run → Success
1. Laptop: `cd ~/Downloads/emki-training` → `unzip -o ~/Downloads/emki-training-update-3-4.zip -d .` → `git add -A` → `git commit -m "Update 3.4"` → `git push`
2. VPS: `ssh root@187.127.223.225` → `cd ~/emki-training` → `git pull` → `npm install` → `npm run build` → `pm2 restart emki-training` → `pm2 list` → `exit`
3. Perbaiki AYUMSARI: Panel Admin → Pendaftar → AYUMSARI → kotak "Kelola peserta" → pilih koordinator → centang hitung ulang harga → Simpan koordinator.
