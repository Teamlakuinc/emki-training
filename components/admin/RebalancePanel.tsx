'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rebalanceSessions } from '@/app/admin/actions';

export default function RebalancePanel({ scheduleId }: { scheduleId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moves, setMoves] = useState<any[] | null>(null);
  const [notify, setNotify] = useState(true);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Urutkan sesi berdasarkan skema</h2>
      <p className="muted small">Skema lebih tinggi mendapat sesi lebih awal (Executive Chef → Sous Chef → Chef de Partie → Demi Chef → Cook). Dalam skema yang sama, yang lebih dulu membayar/mendaftar didahulukan. Kuota tiap sesi tetap dipatuhi. Sebaiknya dijalankan setelah batas pendaftaran.</p>
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
      <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => start(async () => {
        setMsg(null); const r = await rebalanceSessions(scheduleId, false, false);
        if (!r.ok) return setMsg({ t: 'err', m: r.error! }); setMoves(r.data || []);
      })}>1. Lihat pratinjau perpindahan</button>
      {moves && (moves.length === 0 ? <p className="small" style={{ marginTop: 10 }}>✅ Urutan sesi sudah sesuai. Tidak ada yang perlu dipindah.</p> : (<>
        <div className="tbl-wrap" style={{ margin: '12px 0' }}><table className="tbl"><thead><tr><th>Nama</th><th>Skema</th><th>Dari</th><th>Ke</th></tr></thead>
          <tbody>{moves.map(m => <tr key={m.application_id}><td>{m.full_name}</td><td>{m.scheme_name}</td><td>{m.from_session}</td><td><b>{m.to_session}</b></td></tr>)}</tbody></table></div>
        <label className="check small" style={{ marginBottom: 10 }}><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />Kirim email "Perubahan sesi" ke peserta yang dipindah</label>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => { if (confirm(`Pindahkan ${moves.length} peserta sesuai pratinjau?`)) start(async () => {
          const r = await rebalanceSessions(scheduleId, true, notify);
          if (!r.ok) return setMsg({ t: 'err', m: r.error! });
          setMsg({ t: 'ok', m: `${(r.data || []).length} peserta dipindahkan${notify ? ' dan diberi email' : ''}. Kirim juga kabar lewat WhatsApp (template "Perubahan jadwal/sesi") bila perlu.` });
          setMoves(null); router.refresh(); }); }}>2. Terapkan perpindahan</button>
      </>))}
    </div>
  );
}
