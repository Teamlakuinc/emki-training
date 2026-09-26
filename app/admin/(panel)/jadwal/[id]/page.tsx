import { notFound } from 'next/navigation';
import { requireStaff, isAdminRole } from '@/lib/admin';
import { tanggal } from '@/lib/format';
import { APP_SELECT } from '@/lib/queries';
import ScheduleForm from '@/components/admin/ScheduleForm';
import SessionEditor from '@/components/admin/SessionEditor';
import ApplicantTable from '@/components/admin/ApplicantTable';

export default async function Page({ params, searchParams }: { params: { id: string }; searchParams: { semua?: string } }) {
  const { supabase, role } = await requireStaff();
  const { data: j } = await supabase.from('exam_schedules').select('*').eq('id', params.id).maybeSingle();
  if (!j) notFound();
  const [{ data: sessions }, { data: schemes }, { data: links }, { data: templates }] = await Promise.all([
    supabase.from('exam_sessions').select('*').eq('schedule_id', j.id).order('sort_order'),
    supabase.from('schemes').select('id,name').order('level_order'),
    supabase.from('exam_schedule_schemes').select('scheme_id').eq('schedule_id', j.id),
    supabase.from('message_templates').select('key,title,body').eq('channel', 'whatsapp').eq('is_active', true).order('sort_order'),
  ]);
  const ids = (sessions || []).map(s => s.id);
  let q = supabase.from('applications').select(APP_SELECT).in('session_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).order('paid_at', { ascending: true, nullsFirst: false });
  q = searchParams.semua ? q.neq('status', 'draft') : q.eq('status', 'paid');
  const { data: rows } = await q;
  const { data: seatRows } = await supabase.from('applications').select('session_id,status,payment_due_at').in('session_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const now = Date.now(); const counts: Record<string, number> = {};
  (seatRows || []).forEach((r: any) => { if (['submitted', 'revision_required', 'recommended', 'paid'].includes(r.status) || (r.status === 'awaiting_payment' && new Date(r.payment_due_at).getTime() > now)) counts[r.session_id] = (counts[r.session_id] || 0) + 1; });
  const admin = isAdminRole(role);
  const bySession = (sid: string) => (rows || []).filter((r: any) => r.session_id === sid);
  return (
    <>
      <a href="/admin/jadwal" className="small">← Semua jadwal</a>
      <h1 style={{ marginTop: 6 }}>{j.title}</h1>
      <p className="muted">{tanggal(j.exam_date)} · {j.tuk}</p>

      <h2 style={{ marginTop: 24 }}>Peserta {searchParams.semua ? '(semua yang sudah mengirim)' : '(lunas)'}</h2>
      <p className="small"><a href={searchParams.semua ? `/admin/jadwal/${j.id}` : `/admin/jadwal/${j.id}?semua=1`}>{searchParams.semua ? 'Tampilkan yang lunas saja' : 'Tampilkan semua yang sudah mengirim'}</a></p>
      {(sessions || []).map(s => <div key={s.id} style={{ marginBottom: 20 }}>
        <h3>{s.name} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} <span className="muted small">({counts[s.id] || 0}/{s.quota} kursi terisi)</span></h3>
        <ApplicantTable rows={bySession(s.id)} templates={templates || []} site={process.env.NEXT_PUBLIC_SITE_URL || ''} showSchedule={false} />
      </div>)}

      {admin && <>
        <h2 style={{ marginTop: 28 }}>Sesi & kuota</h2>
        <SessionEditor scheduleId={j.id} sessions={sessions || []} counts={counts} />
        <div className="card" style={{ marginTop: 24 }}><h2>Pengaturan jadwal</h2>
          <ScheduleForm j={j} schemes={schemes || []} selected={(links || []).map(l => l.scheme_id)} /></div>
      </>}
    </>
  );
}
