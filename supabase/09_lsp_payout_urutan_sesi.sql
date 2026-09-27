-- =====================================================================
-- 09_lsp_payout_urutan_sesi.sql
--  1. Nama lembaga: LSP Rajawali Hospitality Nusantara
--  2. Pencatatan markup yang sudah dibayarkan ke koordinator
--  3. Atur ulang sesi: skema lebih tinggi mendapat sesi lebih awal
-- Jalankan SEKALI setelah 08.
-- =====================================================================

-- 1. Nama LSP
update public.certification_groups set body_name = 'LSP Rajawali Hospitality Nusantara'
 where body_name = 'LSP Rajawali' or slug = 'bnsp-juru-masak';

-- 2. Markup yang sudah dibayarkan ke koordinator
alter table public.applications add column if not exists markup_paid_at timestamptz;

-- 3. Atur ulang sesi dalam satu jadwal.
--    Urutan: level skema tertinggi dulu (Executive Chef → Cook), lalu yang lebih dulu bayar/daftar.
--    Peserta diisi ke sesi paling awal sampai kuotanya penuh, lalu sesi berikutnya.
--    p_apply = false → hanya pratinjau (tidak mengubah apa pun).
create or replace function public.admin_rebalance_sessions(p_schedule uuid, p_apply boolean default false)
returns table (application_id uuid, full_name text, scheme_name text, from_session text, to_session text, to_session_id uuid)
language plpgsql security definer set search_path = public as $$
declare s record; a record; sess uuid[]; quotas int[]; names text[]; i int := 1; used int := 0;
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  select array_agg(id order by sort_order, start_time), array_agg(quota order by sort_order, start_time), array_agg(name order by sort_order, start_time)
    into sess, quotas, names from public.exam_sessions where schedule_id = p_schedule;
  if sess is null then return; end if;
  if p_apply then perform set_config('emki.system', 'on', true); end if;
  for a in
    select ap.id, ap.full_name, sc.name as sname, ap.session_id, os.name as oname
      from public.applications ap
      join public.schemes sc on sc.id = ap.scheme_id
      join public.exam_sessions os on os.id = ap.session_id
     where os.schedule_id = p_schedule
       and ( ap.status in ('submitted','revision_required','recommended','paid')
          or (ap.status = 'awaiting_payment' and ap.payment_due_at > now()) )
     order by sc.level_order desc, coalesce(ap.paid_at, ap.submitted_at, ap.created_at) asc
  loop
    while used >= quotas[i] and i < array_length(sess, 1) loop i := i + 1; used := 0; end loop;
    used := used + 1;
    if a.session_id <> sess[i] then
      application_id := a.id; full_name := a.full_name; scheme_name := a.sname;
      from_session := a.oname; to_session := names[i]; to_session_id := sess[i];
      if p_apply then update public.applications set session_id = sess[i] where id = a.id; end if;
      return next;
    end if;
  end loop;
end $$;
revoke execute on function public.admin_rebalance_sessions(uuid, boolean) from public, anon;
grant execute on function public.admin_rebalance_sessions(uuid, boolean) to authenticated;

-- 4. Template email saat sesi dipindahkan
insert into public.message_templates (key, channel, title, subject, body, sort_order) values
('email_pindah_sesi','email','Perubahan sesi Ujikom','Perubahan sesi Uji Kompetensi — {reg_code}',
'Halo {nama},

Sesi Uji Kompetensi Anda telah disesuaikan:

Skema: {skema}
Tanggal: {tanggal}
Sesi: {sesi} ({jam})
TUK: {tuk}
Alamat: {alamat}

Mohon hadir 30 menit sebelum sesi dimulai. Terima kasih.

Tim EMKI',17)
on conflict (key) do nothing;
