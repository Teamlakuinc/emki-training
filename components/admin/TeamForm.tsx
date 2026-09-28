'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setRole } from '@/app/admin/actions';

export default function TeamForm({ coordinators = [] }: { coordinators?: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(''); const [role, setR] = useState('verifikator'); const [cid, setCid] = useState('');
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  return (
    <form className="card" onSubmit={e => { e.preventDefault(); start(async () => { const r = await setRole(email, role, cid); setMsg(r.ok ? { t: 'ok', m: 'Role diperbarui.' } : { t: 'err', m: r.error! }); if (r.ok) { setEmail(''); router.refresh(); } }); }}>
      <h2>Tambah / ubah anggota tim</h2>
      <p className="muted small">Orangnya harus <b>membuat akun dulu</b> di halaman Buat Akun (dan konfirmasi email). Setelah itu masukkan emailnya di sini. Saat pertama membuka panel admin, ia akan diminta memasang verifikasi 2 langkah.</p>
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
      <div className="grid2">
        <div className="field"><label htmlFor="em">Email akun</label><input id="em" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="rl">Role</label><select id="rl" value={role} onChange={e => setR(e.target.value)}>
          <option value="verifikator">Verifikator (verifikasi kelayakan & pembayaran, lihat data, download)</option>
          <option value="koordinator">Koordinator (portal koordinator: peserta via link-nya, Sisfo, komisi)</option>
          <option value="participant">Cabut akses (jadi peserta biasa)</option></select></div>
      </div>
      {role === 'koordinator' && <div className="field"><label htmlFor="cd">Hubungkan ke data koordinator</label>
        <select id="cd" value={cid} onChange={e => setCid(e.target.value)} required><option value="">— pilih —</option>
          {coordinators.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code}){c.user_id ? ' · sudah terhubung' : ''}</option>)}</select>
        <div className="hint">Buat dulu datanya di menu Koordinator (kode link & markup/komisi).</div></div>}
      <button className="btn btn-primary" disabled={pending}>Simpan</button>
    </form>
  );
}
