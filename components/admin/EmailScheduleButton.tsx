'use client';
import { useState, useTransition } from 'react';
import { emailSchedule } from '@/app/admin/actions';

export default function EmailScheduleButton({ scheduleId }: { scheduleId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  return (
    <div className="row" style={{ marginTop: 12 }}>
      <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => { if (confirm('Kirim email informasi jadwal ke semua peserta LUNAS di jadwal ini?')) start(async () => { const r = await emailSchedule(scheduleId); setMsg(r.ok ? r.data : r.error!); }); }}>
        ✉️ {pending ? 'Mengirim…' : 'Kirim email jadwal ke semua peserta lunas'}</button>
      {msg && <span className="small">{msg}</span>}
    </div>
  );
}
