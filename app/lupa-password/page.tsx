'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Page() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${site}/auth/callback?next=/reset-password` });
    setBusy(false); setSent(true);   // selalu tampil sukses agar tidak membocorkan email terdaftar/tidak
  }
  return (
    <div className="card narrow" style={{ margin: '0 auto' }}>
      <h1>Lupa password</h1>
      {sent ? <p>Jika email tersebut terdaftar, link untuk membuat password baru sudah dikirim. Cek juga folder Spam.</p> : (
        <form onSubmit={onSubmit}>
          <div className="field"><label htmlFor="e">Email akun</label><input id="e" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <button className="btn btn-primary btn-block" disabled={busy}>Kirim link reset</button>
        </form>)}
    </div>
  );
}
