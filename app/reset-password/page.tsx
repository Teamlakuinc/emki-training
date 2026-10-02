'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Page() {
  const router = useRouter();
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (pw.length < 8) return setErr('Password minimal 8 karakter.');
    if (pw !== pw2) return setErr('Konfirmasi password tidak sama.');
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(/session|auth/i.test(error.message) ? 'Sesi reset tidak ditemukan. Buka kembali link dari email, lalu klik Lanjutkan.' : 'Password ditolak (terlalu lemah atau pernah bocor). Gunakan kombinasi lain.');
    await supabase.auth.signOut();
    router.replace('/masuk?reset=1');
  }
  return (
    <div className="card narrow" style={{ margin: '0 auto' }}>
      <h1>Buat password baru</h1>
      {err && <div className="alert alert-err">{err}</div>}
      <form onSubmit={onSubmit}>
        <div className="field"><label htmlFor="p">Password baru</label><input id="p" type="password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} /></div>
        <div className="field"><label htmlFor="p2">Ulangi password</label><input id="p2" type="password" required value={pw2} onChange={e => setPw2(e.target.value)} /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>Simpan password</button>
      </form>
    </div>
  );
}
