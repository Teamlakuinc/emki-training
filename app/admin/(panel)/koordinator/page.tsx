import Link from 'next/link';
import { requireStaff } from '@/lib/admin';
import { rupiah } from '@/lib/format';
import CoordinatorForm from '@/components/admin/CoordinatorForm';

export default async function Page() {
  const { supabase } = await requireStaff('admin');
  const [{ data: list }, { data: schemes }, { data: apps }] = await Promise.all([
    supabase.from('coordinators').select('id,code,name,phone,is_active').order('name'),
    supabase.from('schemes').select('id,name').order('level_order'),
    supabase.from('applications').select('coordinator_id,status,commission_amount').not('coordinator_id', 'is', null),
  ]);
  const stat = (id: string) => { const a = (apps || []).filter((x: any) => x.coordinator_id === id);
    return { total: a.filter((x: any) => x.status !== 'draft').length, paid: a.filter((x: any) => x.status === 'paid').length,
      markup: a.filter((x: any) => x.status === 'paid').reduce((n: number, x: any) => n + Number(x.commission_amount || 0), 0) }; };
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  return (
    <>
      <h1>Koordinator & referral</h1>
      <div className="tbl-wrap" style={{ marginBottom: 24 }}><table className="tbl">
        <thead><tr><th>Nama</th><th>Link referral</th><th>Pendaftar</th><th>Lunas</th><th>Komisi (lunas)</th><th>Status</th></tr></thead>
        <tbody>{(list || []).map(c => { const s = stat(c.id); return (
          <tr key={c.id}><td><Link href={`/admin/koordinator/${c.id}`}>{c.name}</Link></td><td className="small"><code>{site}/r/{c.code}</code></td>
            <td>{s.total}</td><td>{s.paid}</td><td>{rupiah(s.markup)}</td><td>{c.is_active ? 'Aktif' : 'Nonaktif'}</td></tr>); })}
          {!list?.length && <tr><td colSpan={6} className="muted">Belum ada koordinator.</td></tr>}</tbody>
      </table></div>
      <div className="card"><h2>Tambah koordinator</h2><CoordinatorForm schemes={schemes || []} /></div>
    </>
  );
}
