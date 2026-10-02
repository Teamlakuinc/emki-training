'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { repriceAll, repriceOne } from '@/app/admin/actions';

export function RepriceAllButton({ count }: { count: number }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [msg, setMsg] = useState('');
  return (<span className="row"><button className="btn btn-primary btn-sm" disabled={pending || !count} onClick={() => { if (confirm(`Sesuaikan ${count} tagihan ke harga yang berlaku?`)) start(async () => { const r = await repriceAll(); setMsg(r.ok ? `${r.data} tagihan disesuaikan.` : r.error!); router.refresh(); }); }}>↻ Sesuaikan semua ({count})</button>{msg && <span className="small">{msg}</span>}</span>);
}
export function RepriceOneButton({ id }: { id: string }) {
  const router = useRouter(); const [pending, start] = useTransition();
  return <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => start(async () => { await repriceOne(id); router.refresh(); })}>Sesuaikan</button>;
}
