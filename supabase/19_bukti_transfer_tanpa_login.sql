-- 19. Upload bukti transfer dari link bayar tanpa login (per peserta & kolektif)
-- Jalankan di Supabase EMKI Training → SQL Editor → Run. Aman dijalankan ulang.
alter table public.payment_proofs add column if not exists group_code text;      -- KOL-XXXXXX untuk tagihan kolektif
alter table public.payment_proofs add column if not exists total_amount numeric(12,0);  -- total transfer kolektif
alter table public.payment_proofs add column if not exists via_link boolean not null default false;
create index if not exists payment_proofs_group_idx on public.payment_proofs (group_code) where group_code is not null;
notify pgrst, 'reload schema';
