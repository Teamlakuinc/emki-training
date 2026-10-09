import { requireStaff } from '@/lib/admin';
import AccountsTable from '@/components/admin/AccountsTable';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function Page({ searchParams }: { searchParams: { semua?: string } }) {
  const { supabase } = await requireStaff();
  const [{ data: profs }, { data: apps }, { data: coords }, { data: tpl }] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,phone_wa,created_at,coordinator_id').eq('role', 'participant').order('created_at', { ascending: false }).limit(1000),
    supabase.from('applications').select('id,user_id,status,created_at').order('created_at', { ascending: false }),
    supabase.from('coordinators').select('id,code'),
    supabase.from('message_templates').select('body').eq('key', 'wa_lanjutkan_daftar').maybeSingle(),
  ]);
  // akun yang belum konfirmasi email
  const unconfirmed = new Set<string>();
  try {
    const admin = createAdminClient();
    for (let page = 1; page <= 10; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const users = data?.users || [];
      users.forEach(u => { if (!u.email_confirmed_at) unconfirmed.add(u.id); });
      if (users.length < 1000) break;
    }
  } catch {}
  const latest: Record<string, any> = {};
  for (const a of apps || []) if (!latest[a.user_id]) latest[a.user_id] = a;
  const code = (id?: string) => (coords || []).find(c => c.id === id)?.code;
  let rows = (profs || []).map(p => ({ ...p, app: latest[p.id] || null, coord: code(p.coordinator_id), unconfirmed: unconfirmed.has(p.id) }));
  if (!searchParams.semua) rows = rows.filter(r => !r.app || r.app.status === 'draft');
  return (<>
    <h1>Akun peserta</h1>
    <p className="muted">{searchParams.semua ? 'Semua akun peserta.' : 'Akun yang sudah dibuat tapi pendaftarannya belum dikirim (belum mulai / masih draft). Klik "Ingatkan" untuk kirim WA.'}{' '}
      <a href={searchParams.semua ? '/admin/akun' : '/admin/akun?semua=1'}>{searchParams.semua ? 'Tampilkan yang belum selesai saja' : 'Tampilkan semua akun'}</a></p>
    {unconfirmed.size > 0 && <div className="alert alert-warn">⚠️ <b>{unconfirmed.size} akun belum konfirmasi email</b> (email konfirmasi mungkin tidak sampai). Klik <b>✓ Aktifkan</b> di baris akunnya, atau aktifkan semuanya sekaligus di bawah tabel.</div>}
    <AccountsTable unconfirmedCount={unconfirmed.size} rows={rows} tpl={tpl?.body || 'Halo {nama}, lanjutkan pendaftaran Anda di {link}'} site={process.env.NEXT_PUBLIC_SITE_URL || ''} />
    <p className="muted small" style={{ marginTop: 10 }}>Isi pesan bisa diubah di Template Pesan → "Ingatkan lanjutkan pendaftaran". Akun yang dibuat sebelum update ini belum punya nomor WA.</p>
  </>);
}
