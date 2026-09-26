'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSession, deleteSession } from '@/app/admin/actions';
import { jam } from '@/lib/format';

export default function SessionEditor({ scheduleId, sessions, counts }: { scheduleId: string; sessions: any[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const submit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
    start(async () => { setErr(''); const r = await saveSession(f); if (!r.ok) return setErr(r.error!); if (!f.get('id')) form.reset(); router.refresh(); }); };
  const inp = { style: { font: 'inherit', fontSize: 14, padding: '7px 8px', border: '1.5px solid #D5D8DC', borderRadius: 8, width: '100%' } };
  return (
    <>
      {err && <div className="alert alert-err">{err}</div>}
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Urutan</th><th>Nama sesi</th><th>Mulai</th><th>Selesai</th><th>Kuota</th><th>Terisi</th><th></th></tr></thead>
        <tbody>
          {sessions.map(s => (
            <tr key={s.id}><td colSpan={7} style={{ padding: 0 }}>
              <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '70px 1.4fr 1fr 1fr 80px 70px auto', gap: 8, padding: '8px 12px', alignItems: 'center' }}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="schedule_id" value={scheduleId} />
                <input name="sort_order" type="number" defaultValue={s.sort_order} {...inp} />
                <input name="name" defaultValue={s.name} required {...inp} />
                <input name="start_time" type="time" defaultValue={jam(s.start_time)} required {...inp} />
                <input name="end_time" type="time" defaultValue={jam(s.end_time)} required {...inp} />
                <input name="quota" type="number" min={1} defaultValue={s.quota} required {...inp} />
                <span className="small"><b>{counts[s.id] || 0}</b>/{s.quota}</span>
                <span className="row" style={{ gap: 6 }}><button className="btn btn-outline btn-sm" disabled={pending}>Simpan</button>
                  <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => { if (confirm(`Hapus ${s.name}?`)) start(async () => { const r = await deleteSession(s.id, scheduleId); if (!r.ok) setErr(r.error!); router.refresh(); }); }}>Hapus</button></span>
              </form>
            </td></tr>
          ))}
          <tr><td colSpan={7} style={{ padding: 0, background: 'var(--panel)' }}>
            <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '70px 1.4fr 1fr 1fr 80px 70px auto', gap: 8, padding: '8px 12px', alignItems: 'center' }}>
              <input type="hidden" name="schedule_id" value={scheduleId} />
              <input name="sort_order" type="number" defaultValue={sessions.length + 1} {...inp} />
              <input name="name" placeholder={`Sesi ${sessions.length + 1}`} defaultValue={`Sesi ${sessions.length + 1}`} required {...inp} />
              <input name="start_time" type="time" required {...inp} /><input name="end_time" type="time" required {...inp} />
              <input name="quota" type="number" min={1} placeholder="15" required {...inp} /><span />
              <button className="btn btn-primary btn-sm" disabled={pending}>+ Tambah sesi</button>
            </form>
          </td></tr>
        </tbody>
      </table></div>
      <p className="muted small">Peserta memilih sendiri sesi yang masih ada kuotanya. Kuota bisa dinaikkan kapan saja; sesi yang sudah dipilih peserta tidak bisa dihapus.</p>
    </>
  );
}
