'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { payApp, checkApp, payGroup, checkGroup } from './actions';

/** Tombol bayar + cek status otomatis setelah kembali dari DOKU. */
export default function PayButton({ token, kind, label, autoCheck }: { token: string; kind: 'app' | 'group'; label: string; autoCheck?: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [pending, start] = useTransition();
  const check = () => start(async () => {
    setErr(''); setInfo('Mengecek status pembayaran…');
    const r = kind === 'app' ? await checkApp(token) : await checkGroup(token);
    setInfo(r?.status === 'paid' ? '' : 'Pembayaran belum terkonfirmasi. Kalau Anda baru saja membayar, tunggu 1–2 menit lalu klik "Cek status".');
    router.refresh();
  });
  useEffect(() => { if (autoCheck) check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (<>
    {err && <div className="alert alert-err">{err}</div>}
    {info && <div className="alert alert-info small">{info}</div>}
    <button className="btn btn-primary btn-block" disabled={pending} onClick={() => start(async () => {
      setErr(''); setInfo('');
      const r = kind === 'app' ? await payApp(token) : await payGroup(token);
      if (!r.ok || !r.url) return setErr(r.error || 'Gagal membuka pembayaran.');
      window.location.href = r.url;
    })}>{pending ? 'Memproses…' : label}</button>
    <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} disabled={pending} onClick={check}>↻ Cek status pembayaran</button>
  </>);
}
