'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setRole } from '@/app/admin/actions';

export default function TeamForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(''); const [role, setR] = useState('verifikator');
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  return (
    <form className="card" onSubmit={e => { e.preventDefault(); start(async () => { const r = await setRole(email, role); setMsg(r.ok ? { t: 'ok', m: 'Role diperbarui.' } : { t: 'err', m: r.error! }); if (r.ok) { setEmail(''); router.refresh(); } }); }}>
      <h2>Tambah / ubah anggota tim</h2>
      <p className="muted small">Orangnya harus <b>membuat akun dulu</b> di halaman Buat Akun (dan konfirmasi email). Setelah itu masukkan emailnya di sini. Saat pertama membuka panel admin, ia akan diminta memasang verifikasi 2 langkah.</p>
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
      <div className="grid2">
        <div className="field"><label htmlFor="em">Email akun</label><input id="em" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="rl">Role</label><select id="rl" value={role} onChange={e => setR(e.target.value)}>
          <option value="verifikator">Verifikator (verifikasi, lihat data, WA, download)</option>
          <option value="admin">Admin (semua + jadwal, template, password SIAPkerja)</option>
          <option value="participant">Cabut akses (jadi peserta biasa)</option></select></div>
      </div>
      <button className="btn btn-primary" disabled={pending}>Simpan</button>
    </form>
  );
}
