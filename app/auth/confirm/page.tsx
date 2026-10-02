'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/* Link di email mengarah ke sini. Token baru dipakai saat tombol ditekan,
   sehingga pemindai link (Gmail, WhatsApp, antivirus) tidak "menghabiskan" link-nya. */
function Confirm() {
  const router = useRouter();
  const q = useSearchParams();
  const tokenHash = q.get('token_hash') || '';
  const type = (q.get('type') || 'email') as any;
  const nextRaw = q.get('next') || (type === 'recovery' ? '/reset-password' : '/akun');
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/akun';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isReset = type === 'recovery';

  async function go() {
    setErr(''); setBusy(true);
    const { error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type });
    setBusy(false);
    if (error) { setErr('expired'); return; }
    router.replace(next); router.refresh();
  }

  return (
    <div className="card narrow center" style={{ margin: '0 auto' }}>
      <span className="eyebrow">{isReset ? 'Reset password' : 'Konfirmasi email'}</span>
      <h1>{isReset ? 'Buat password baru' : 'Aktifkan akun Anda'}</h1>
      {!tokenHash ? <p>Link tidak lengkap. Silakan buka kembali link dari email Anda.</p> : err ? (
        <>
          <div className="alert alert-err">Link ini sudah tidak berlaku (sudah dipakai atau lewat 1 jam).</div>
          {isReset ? <Link className="btn btn-primary" href="/lupa-password">Kirim link reset baru</Link>
                   : <Link className="btn btn-primary" href="/masuk">Coba masuk</Link>}
        </>
      ) : (
        <>
          <p className="muted">{isReset ? 'Klik tombol di bawah untuk melanjutkan membuat password baru.' : 'Klik tombol di bawah untuk mengaktifkan akun dan melanjutkan pendaftaran.'}</p>
          <button className="btn btn-primary btn-block" onClick={go} disabled={busy}>{busy ? 'Memproses…' : isReset ? 'Lanjutkan' : 'Aktifkan akun'}</button>
        </>
      )}
    </div>
  );
}
export default function Page() { return <Suspense><Confirm /></Suspense>; }
