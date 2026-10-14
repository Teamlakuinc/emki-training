import { requireStaff, isAdminRole } from '@/lib/admin';
import AdminShell from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel Admin' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, name, supabase, user } = await requireStaff();
  const [{ count: proofs }, { count: verif }, { data: seen }, { data: notifs }] = await Promise.all([
    supabase.from('payment_proofs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
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
  const main = [
    { href: '/admin', label: 'Beranda', icon: 'home' },
    { href: '/admin/pendaftar?status=submitted', label: 'Verifikasi', icon: 'check', badge: verif || 0 },
    { href: '/admin/pembayaran', label: 'Bayar', icon: 'card', badge: proofs || 0 },
    { href: '/admin/pendaftar', label: 'Peserta', icon: 'users' },
  ];
  const more = [
    { href: '/admin/notifikasi', label: 'Notifikasi', icon: 'bell', badge: unread },
    { href: '/admin/bayar-kolektif', label: 'Bayar Kolektif', icon: 'group' },
    { href: '/admin/akun', label: 'Akun Peserta', icon: 'user' },
    { href: '/admin/jadwal', label: 'Jadwal Ujikom', icon: 'cal' },
    ...(admin ? [
      { href: '/admin/skema', label: 'Skema & Harga', icon: 'tag' },
      { href: '/admin/koordinator', label: 'Koordinator', icon: 'link' },
      { href: '/admin/formulir', label: 'Formulir', icon: 'form' },
      { href: '/admin/template', label: 'Template Pesan', icon: 'chat' },
    ] : []),
    ...(role === 'super_admin' ? [
      { href: '/admin/pengaturan', label: 'Pengaturan', icon: 'gear' },
      { href: '/admin/tim', label: 'Tim', icon: 'team' },
    ] : []),
  ];
  return (
    <AdminShell name={name || ''} role={role} main={main} more={more} bell={{ items: notifs || [], unread, lastSeen }}>
      {children}
    </AdminShell>
  );
}
