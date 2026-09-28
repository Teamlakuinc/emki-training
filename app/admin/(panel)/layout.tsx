import Link from 'next/link';
import { requireStaff, isAdminRole } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel Admin' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, name, supabase } = await requireStaff();
  const { count: proofs } = await supabase.from('payment_proofs').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  const admin = isAdminRole(role);
  return (
    <>
      <nav className="adm-nav" aria-label="Menu admin">
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/pendaftar?status=submitted">Verifikasi</Link>
        <Link href="/admin/pembayaran">Konfirmasi Pembayaran{proofs ? <span className="badge amber" style={{ marginLeft: 6 }}>{proofs}</span> : null}</Link>
        <Link href="/admin/pendaftar">Pendaftar</Link>
        <Link href="/admin/jadwal">Jadwal Ujikom</Link>
        {admin && <Link href="/admin/skema">Skema & Harga</Link>}
        {admin && <Link href="/admin/koordinator">Koordinator</Link>}
        {admin && <Link href="/admin/formulir">Formulir</Link>}
        {admin && <Link href="/admin/template">Template Pesan</Link>}
        {role === 'super_admin' && <Link href="/admin/pengaturan">Pengaturan</Link>}
        {role === 'super_admin' && <Link href="/admin/tim">Tim</Link>}
        <span className="who">{name} · {role.replace('_', ' ')}</span>
      </nav>
      {children}
    </>
  );
}
