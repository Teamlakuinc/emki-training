'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function MasukForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/akun';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setErr(error.message.includes('Email not confirmed')
        ? 'Email belum dikonfirmasi. Cek inbox (atau folder Spam) untuk link konfirmasi.'
        : 'Email atau password salah.');
      return;
    }
    router.replace(next.startsWith('/') ? next : '/akun');
    router.refresh();
  }

  return (
    <div className="card narrow" style={{ margin: '0 auto' }}>
      <span className="eyebrow">Masuk</span>
      <h1>Masuk ke akun Anda</h1>
      <p className="muted">Lanjutkan pendaftaran sertifikasi atau cek status pendaftaran.</p>
      {params.get('confirmed') && <div className="alert alert-ok">Email berhasil dikonfirmasi. Silakan masuk.</div>}
      {params.get('reset') && <div className="alert alert-ok">Password berhasil diganti. Silakan masuk.</div>}
      {err && <div className="alert alert-err">{err}</div>}
      <form onSubmit={onSubmit}>
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
      </form>
      <p className="small" style={{ marginTop: 16 }}><Link href="/lupa-password">Lupa password?</Link></p>
      <p className="small">Belum punya akun? <Link href={`/daftar-akun?next=${encodeURIComponent(next)}`}>Buat akun</Link></p>
    </div>
  );
}
export default function Page() { return <Suspense><MasukForm /></Suspense>; }
