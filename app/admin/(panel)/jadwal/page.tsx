import Link from 'next/link';
import { requireStaff, isAdminRole } from '@/lib/admin';
import { tanggal } from '@/lib/format';
import ScheduleForm from '@/components/admin/ScheduleForm';

const LBL: Record<string, string> = { draft: 'Draft', open: 'Dibuka', closed: 'Ditutup', done: 'Selesai' };

export default async function Page() {
  const { supabase, role } = await requireStaff();
  const [{ data: list }, { data: schemes }] = await Promise.all([
    supabase.from('exam_schedules').select('id,title,exam_date,tuk,status,exam_sessions(id,quota)').order('exam_date', { ascending: false }),
    supabase.from('schemes').select('id,name,price').order('level_order'),
  ]);
  return (
    <>
      <h1>Jadwal Ujikom</h1>
      <div className="tbl-wrap" style={{ marginBottom: 24 }}><table className="tbl">
        <thead><tr><th>Tanggal</th><th>Jadwal</th><th>TUK</th><th>Sesi</th><th>Total kuota</th><th>Status</th></tr></thead>
        <tbody>{(list || []).map((j: any) => <tr key={j.id}><td>{tanggal(j.exam_date)}</td><td><Link href={`/admin/jadwal/${j.id}`}>{j.title}</Link></td><td>{j.tuk}</td>
          <td>{j.exam_sessions.length}</td><td>{j.exam_sessions.reduce((n: number, s: any) => n + s.quota, 0)}</td><td>{LBL[j.status]}</td></tr>)}
          {!list?.length && <tr><td colSpan={6} className="muted">Belum ada jadwal.</td></tr>}</tbody>
      </table></div>
      {isAdminRole(role) && <div className="card"><h2>Buat jadwal baru</h2><p className="muted small">Setelah jadwal dibuat, Anda akan diarahkan ke halaman jadwal untuk menambahkan sesi dan kuotanya.</p><ScheduleForm schemes={schemes || []} selected={[]} /></div>}
    </>
  );
}
