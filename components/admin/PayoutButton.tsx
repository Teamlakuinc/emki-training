'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markMarkupPaid } from '@/app/admin/actions';
import { rupiah } from '@/lib/format';

export default function PayoutButton({ coordinatorId, unpaid }: { coordinatorId: string; unpaid: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  if (unpaid <= 0) return <span className="small muted">Tidak ada markup yang belum dibayarkan.</span>;
  return (<span className="row">
    <button className="btn btn-green btn-sm" disabled={pending} onClick={() => { if (confirm(`Tandai markup ${rupiah(unpaid)} sudah dibayarkan ke koordinator?`)) start(async () => {
      const r = await markMarkupPaid(coordinatorId); setMsg(r.ok ? `${r.data.count} peserta ditandai (${rupiah(r.data.total)}).` : r.error!); router.refresh(); }); }}>
      ✓ Tandai sudah dibayarkan ({rupiah(unpaid)})</button>{msg && <span className="small">{msg}</span>}</span>);
}
