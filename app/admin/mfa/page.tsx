'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function MfaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<'loading' | 'enroll' | 'verify' | 'denied'>('loading');
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [dest, setDest] = useState('/admin');

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/masuk?next=/admin'); return; }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!prof || !['super_admin', 'admin', 'verifikator', 'koordinator'].includes(prof.role)) { setMode('denied'); return; }
    setDest(prof.role === 'koordinator' ? '/koordinator' : '/admin');
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === 'aal2') { router.replace(prof.role === 'koordinator' ? '/koordinator' : '/admin'); return; }
    const { data: f } = await supabase.auth.mfa.listFactors();
    const verified = f?.totp?.find(x => x.status === 'verified');
    if (verified) { setFactorId(verified.id); setMode('verify'); return; }
    // hapus faktor lama yang belum selesai didaftarkan, lalu daftar baru
    for (const x of f?.all || []) if (x.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'EMKI ' + Date.now() });
    if (error) { setErr(error.message); return; }
    setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret); setMode('enroll');
  })(); }, []); // eslint-disable-line

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
    setBusy(false);
    if (error) { setErr('Kode salah atau sudah kedaluwarsa. Coba kode terbaru dari aplikasi.'); return; }
    router.replace(dest); router.refresh();
  }

  if (mode === 'denied') return <div className="card narrow" style={{ margin: '0 auto' }}><h1>Akses ditolak</h1><p>Akun ini bukan akun Admin/Verifikator/Koordinator.</p></div>;
  return (
    <div className="card narrow" style={{ margin: '0 auto' }}>
      <span className="eyebrow">Keamanan</span>
      <h1>Verifikasi 2 langkah</h1>
      {mode === 'loading' && <p className="muted">Memuat…</p>}
      {mode === 'enroll' && (<>
        <p>Panel admin wajib memakai verifikasi 2 langkah. Lakukan sekali saja:</p>
        <ol className="small" style={{ paddingLeft: 18 }}>
          <li>Pasang aplikasi <b>Google Authenticator</b> (atau Microsoft Authenticator) di HP.</li>
          <li>Buka aplikasinya → <b>+</b> → <b>Scan QR code</b> → arahkan ke kode di bawah.</li>
          <li>Ketik 6 angka yang muncul di aplikasi.</li>
        </ol>
        {qr && <img src={qr} alt="QR verifikasi 2 langkah" style={{ width: 200, height: 200, display: 'block', margin: '10px auto', background: '#fff' }} />}
        <p className="muted small center">Tidak bisa scan? Masukkan kode ini manual: <code style={{ wordBreak: 'break-all' }}>{secret}</code></p>
      </>)}
      {mode === 'verify' && <p>Buka aplikasi Authenticator di HP Anda, lalu masukkan 6 angka untuk <b>EMKI</b>.</p>}
      {err && <div className="alert alert-err">{err}</div>}
      {(mode === 'enroll' || mode === 'verify') && (
        <form onSubmit={submit}>
          <div className="field"><label htmlFor="c">Kode 6 angka</label>
            <input id="c" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required value={code} onChange={e => setCode(e.target.value)} style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center' }} /></div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Memeriksa…' : 'Verifikasi'}</button>
        </form>)}
    </div>
  );
}
