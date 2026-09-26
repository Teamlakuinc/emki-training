'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function DaftarForm() {
  const params = useSearchParams();
  const next = params.get('next') || '/akun';
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (f.pw.length < 8) return setErr('Password minimal 8 karakter.');
    if (f.pw !== f.pw2) return setErr('Konfirmasi password tidak sama.');
    setBusy(true);
    const supabase = createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.pw,
      options: { data: { full_name: f.name.trim() }, emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) {
      setErr(/already|registered/i.test(error.message) ? 'Email ini sudah terdaftar. Silakan masuk.' :
             /password/i.test(error.message) ? 'Password terlalu lemah atau pernah bocor. Gunakan kombinasi lain.' : error.message);
      return;
    }
    setDone(true);
  }

  if (done) return (
    <div className="card narrow" style={{ margin: '0 auto' }}>
      <h1>Cek email Anda</h1>
      <p>Kami mengirim link konfirmasi ke <b>{f.email}</b>. Klik link tersebut untuk mengaktifkan akun, lalu lanjutkan pendaftaran.</p>
      <p className="muted">Tidak menemukan email? Cek folder <b>Spam/Promosi</b>. Email dikirim dari hi@edukasikuliner.com.</p>
    </div>
  );

  return (
    <div className="card narrow" style={{ margin: '0 auto' }}>
      <span className="eyebrow">Buat Akun</span>
      <h1>Buat akun pendaftaran</h1>
      <p className="muted">Akun dipakai untuk menyimpan draft, mengunggah dokumen, dan melihat status sertifikasi Anda.</p>
      {err && <div className="alert alert-err">{err}</div>}
      <form onSubmit={onSubmit}>
        <div className="field"><label htmlFor="n">Nama lengkap</label><input id="n" required autoComplete="name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="e">Email aktif</label><input id="e" type="email" required autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /><div className="hint">Semua informasi sertifikasi dikirim ke email ini.</div></div>
        <div className="field"><label htmlFor="p">Password</label><input id="p" type="password" required autoComplete="new-password" minLength={8} value={f.pw} onChange={e => setF({ ...f, pw: e.target.value })} /><div className="hint">Minimal 8 karakter.</div></div>
        <div className="field"><label htmlFor="p2">Ulangi password</label><input id="p2" type="password" required autoComplete="new-password" value={f.pw2} onChange={e => setF({ ...f, pw2: e.target.value })} /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Memproses…' : 'Buat Akun'}</button>
      </form>
      <p className="small" style={{ marginTop: 16 }}>Sudah punya akun? <Link href={`/masuk?next=${encodeURIComponent(next)}`}>Masuk</Link></p>
    </div>
  );
}
export default function Page() { return <Suspense><DaftarForm /></Suspense>; }
