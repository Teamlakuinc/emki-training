import Link from 'next/link';
import { requireStaff, isAdminRole } from '@/lib/admin';
import NotifBell from '@/components/admin/NotifBell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel Admin' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, name, supabase, user } = await requireStaff();
  const [{ count: proofs }, { data: seen }, { data: notifs }] = await Promise.all([
    supabase.from('payment_proofs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('admin_notification_seen').select('last_seen_at').eq('user_id', user.id).maybeSingle(),
    supabase.from('admin_notifications').select('id,kind,title,body,application_id,created_at').order('created_at', { ascending: false }).limit(15),
  ]);
  const lastSeen = seen?.last_seen_at || null;
  let unread = 0;
  if (notifs) {
    let uq = supabase.from('admin_notifications').select('id', { count: 'exact', head: true });
    if (lastSeen) uq = uq.gt('created_at', lastSeen);
    const { count } = await uq; unread = count || 0;
  }
  const admin = isAdminRole(role);
  return (
    <>
      <nav className="adm-nav" aria-label="Menu admin">
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/pendaftar?status=submitted">Verifikasi</Link>
        {proofs ? <Link href="/admin/pembayaran">Konfirmasi Pembayaran<span className="badge amber" style={{ marginLeft: 6 }}>{proofs}</span></Link> : null}
        <Link href="/admin/pendaftar">Pendaftar</Link>
        <Link href="/admin/bayar-kolektif">Bayar Kolektif</Link>
        <Link href="/admin/akun">Akun Peserta</Link>
        <Link href="/admin/jadwal">Jadwal Ujikom</Link>
        {admin && <Link href="/admin/skema">Skema & Harga</Link>}
        {admin && <Link href="/admin/koordinator">Koordinator</Link>}
        {admin && <Link href="/admin/formulir">Formulir</Link>}
        {admin && <Link href="/admin/template">Template Pesan</Link>}
        {role === 'super_admin' && <Link href="/admin/pengaturan">Pengaturan</Link>}
        {role === 'super_admin' && <Link href="/admin/tim">Tim</Link>}
        <span className="who" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><NotifBell items={notifs || []} unread={unread} lastSeen={lastSeen} />{name} · {role.replace('_', ' ')}</span>
      </nav>
      {children}
    </>
  );
}
