-- 15. Batas bayar tidak boleh melewati jam 15.00 WIB sehari sebelum tanggal Ujikom
-- Jalankan di Supabase EMKI Training → SQL Editor → Run. Aman dijalankan ulang.

-- Batas paling akhir untuk sebuah sesi:
--   normal  : H-1 pukul 15.00 WIB
--   kalau H-1 15.00 sudah lewat (daftar mepet): sampai jam mulai sesi di hari Ujikom
create or replace function public.payment_cap_for_session(p_session uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select case
    when ((j.exam_date - 1) + time '15:00') at time zone 'Asia/Jakarta' > now()
      then ((j.exam_date - 1) + time '15:00') at time zone 'Asia/Jakarta'
    else (j.exam_date + s.start_time) at time zone 'Asia/Jakarta'
  end
  from public.exam_sessions s join public.exam_schedules j on j.id = s.schedule_id
  where s.id = p_session
$$;

-- Setiap kali batas bayar diisi/diubah (verifikasi, Cook langsung bayar, perpanjang, pindah sesi, dll.)
-- → otomatis dipotong ke batas paling akhir di atas.
create or replace function public.clamp_payment_due()
returns trigger language plpgsql security definer set search_path = public as $$
declare cap timestamptz;
begin
  if new.payment_due_at is null or new.session_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.payment_due_at is not distinct from old.payment_due_at
     and new.session_id is not distinct from old.session_id then return new; end if;
  cap := public.payment_cap_for_session(new.session_id);
  if cap is not null and new.payment_due_at > cap then new.payment_due_at := cap; end if;
  return new;
end $$;

drop trigger if exists trg_clamp_payment_due on public.applications;
create trigger trg_clamp_payment_due before insert or update on public.applications
  for each row execute function public.clamp_payment_due();

-- Perbaiki pendaftaran yang SEKARANG sedang menunggu pembayaran
update public.applications a
   set payment_due_at = public.payment_cap_for_session(a.session_id)
 where a.status = 'awaiting_payment' and a.session_id is not null
   and a.payment_due_at > public.payment_cap_for_session(a.session_id);

-- Cek hasil: daftar yang menunggu bayar + batas bayarnya (WIB)
select a.reg_code, a.full_name, j.exam_date as tanggal_ujikom,
       to_char(a.payment_due_at at time zone 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') as batas_bayar_wib
  from public.applications a
  join public.exam_sessions s on s.id = a.session_id
  join public.exam_schedules j on j.id = s.schedule_id
 where a.status = 'awaiting_payment'
 order by j.exam_date, a.payment_due_at;
