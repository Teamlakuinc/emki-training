import { requireStaff } from '@/lib/admin';
import TeamForm from '@/components/admin/TeamForm';

export default async function Page() {
  const { supabase } = await requireStaff('super');
  const { data } = await supabase.from('profiles').select('id,email,full_name,role').in('role', ['super_admin', 'admin', 'verifikator', 'koordinator'] as any).order('role');
  const { data: coords } = await supabase.from('coordinators').select('id,name,code,user_id').order('name');
  return (
    <>
      <h1>Tim</h1>
      <div className="tbl-wrap" style={{ marginBottom: 20 }}><table className="tbl"><thead><tr><th>Nama</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>{(data || []).map(p => <tr key={p.email}><td>{p.full_name}</td><td>{p.email}</td><td>{p.role === 'koordinator' ? `koordinator · ${(coords || []).find(c => c.user_id === p.id)?.code || 'belum terhubung'}` : p.role.replace('_', ' ')}</td></tr>)}</tbody></table></div>
      <TeamForm coordinators={coords || []} />
    </>
  );
}
