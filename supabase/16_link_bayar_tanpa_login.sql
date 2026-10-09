-- 16. Link bayar tanpa login: per peserta & kolektif (1 tagihan untuk banyak peserta)
-- Jalankan di Supabase EMKI Training → SQL Editor → Run. Aman dijalankan ulang.

-- 1) Link bayar per peserta
alter table public.applications add column if not exists pay_token text;
create unique index if not exists applications_pay_token_idx on public.applications (pay_token) where pay_token is not null;

-- 2) Tagihan kolektif
create table if not exists public.group_invoices (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,              -- KOL-XXXXXX
  token       text not null unique,              -- untuk link publik
  title       text,
  payer_name  text,
  payer_phone text,
  payer_email text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create table if not exists public.group_invoice_items (
  invoice_id     uuid not null references public.group_invoices(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  primary key (invoice_id, application_id)
);
create table if not exists public.group_payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.group_invoices(id) on delete cascade,
  order_id    text not null unique,              -- KOL-XXXXXX-D1
  amount      numeric(12,0) not null check (amount > 0),
  app_ids     uuid[] not null,                   -- peserta yang ikut dibayar di checkout ini
  amounts     numeric[] not null,                -- nominal per peserta (urutan sama dengan app_ids)
  status      payment_status not null default 'pending',
  snap_token  text,
  paid_at     timestamptz,
  raw_notification jsonb,
  created_at  timestamptz not null default now()
);
alter table public.group_invoices enable row level security;
alter table public.group_invoice_items enable row level security;
alter table public.group_payments enable row level security;
drop policy if exists gi_admin on public.group_invoices;
drop policy if exists gii_admin on public.group_invoice_items;
drop policy if exists gp_admin on public.group_payments;
create policy gi_admin on public.group_invoices for select to authenticated using (public.is_staff());
create policy gii_admin on public.group_invoice_items for select to authenticated using (public.is_staff());
create policy gp_admin on public.group_payments for select to authenticated using (public.is_staff());

-- 3) Terapkan notifikasi DOKU untuk tagihan kolektif (dipanggil server dengan service role)
create or replace function public.apply_group_payment(p_order_id text, p_transaction_status text, p_gross_amount numeric, p_raw jsonb)
returns payment_status language plpgsql security definer set search_path = public as $$
declare g public.group_payments; st payment_status; i int; aid uuid; amt numeric; exam date; reg text;
begin
  select * into g from public.group_payments where order_id = p_order_id for update;
  if not found then raise exception 'order_id % tidak ditemukan', p_order_id; end if;
  if p_gross_amount is not null and p_gross_amount <> g.amount then raise exception 'Nominal tidak sesuai'; end if;
  st := case
    when p_transaction_status = 'settlement' then 'paid'
    when p_transaction_status = 'pending' then 'pending'
    when p_transaction_status = 'expire' then 'expired'
    else g.status end::payment_status;
  if g.status = 'paid' then st := 'paid'; end if;

  update public.group_payments set status = st, raw_notification = p_raw,
    paid_at = case when st = 'paid' and paid_at is null then now() else paid_at end where id = g.id;

  if st = 'paid' and g.status <> 'paid' then
    perform set_config('emki.system', 'on', true);
    for i in 1 .. array_length(g.app_ids, 1) loop
      aid := g.app_ids[i]; amt := g.amounts[i];
      select reg_code into reg from public.applications where id = aid;
      -- catatan pembayaran per peserta (supaya laporan & riwayat tetap rapi)
      insert into public.payments (application_id, order_id, amount, status, payment_type, paid_at, raw_notification)
      values (aid, g.order_id || '-' || coalesce(reg, i::text), amt, 'paid', 'doku-kolektif', now(), jsonb_build_object('kolektif', g.order_id))
      on conflict (order_id) do nothing;
      update public.applications set status = 'paid', paid_at = coalesce(paid_at, now())
       where id = aid and status in ('awaiting_payment','expired');
      select j.exam_date into exam from public.applications a join public.exam_sessions s on s.id = a.session_id
        join public.exam_schedules j on j.id = s.schedule_id where a.id = aid;
      update public.application_secrets set purge_after = exam + 14 where application_id = aid;
    end loop;
  end if;
  return st;
end $$;
revoke execute on function public.apply_group_payment(text, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.apply_group_payment(text, text, numeric, jsonb) to service_role;

notify pgrst, 'reload schema';
