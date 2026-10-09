'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { fixSiapkerja } from '@/app/akun/actions';

export default function FixForm({ id, email, phone, back }: { id: string; email: string; phone: string; back: string }) {
  const router = useRouter();
  const [f, setF] = useState({ email, phone, password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <form onSubmit={e => { e.preventDefault(); setErr(''); start(async () => {
      const r = await fixSiapkerja(id, f);
      if (!r.ok) return setErr(r.error || 'Gagal menyimpan.');
      router.replace(`${back}/siapkerja`); router.refresh();
    }); }}>
      {err && <div className="alert alert-err">{err}</div>}
      <div className="field"><label htmlFor="se">Email terdaftar di SIAPkerja</label><input id="se" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <div className="field"><label htmlFor="sp">No. telepon terdaftar di SIAPkerja</label><input id="sp" type="tel" required value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      <div className="field">
        <label htmlFor="spw">Password akun SIAPkerja (yang benar)</label>
        <input id="spw" type={show ? 'text' : 'password'} autoComplete="off" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
        <label className="check small" style={{ marginTop: 6 }}><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Tampilkan saat mengetik</label>
      </div>
      <div className="alert alert-info small">🔒 Password dienkripsi sebelum disimpan, hanya dapat dibuka admin EMKI untuk pendaftaran (setiap akses tercatat), dan dihapus otomatis setelah Ujikom.</div>
      <button className="btn btn-primary btn-block" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan data SIAPkerja'}</button>
    </form>
  );
}
