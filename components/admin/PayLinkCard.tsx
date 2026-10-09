'use client';
import { useState, useTransition } from 'react';
import { adminPayLink } from '@/app/admin/actions';
import { rupiah, waktu } from '@/lib/format';
import { waNumber } from '@/lib/templates';

/** Link bayar tanpa login untuk 1 peserta (bisa dikirim ke peserta / pihak yang membayari). */
export default function PayLinkCard({ a, site }: { a: any; site: string }) {
  const [url, setUrl] = useState(a.pay_token ? `${site}/bayar/${a.pay_token}` : '');
  const [msg, setMsg] = useState('');
  const [to, setTo] = useState('');
  const [pending, start] = useTransition();
  const get = () => new Promise<string>(resolve => start(async () => {
    if (url) return resolve(url);
    const r = await adminPayLink(a.id); if (!r.ok) { setMsg(r.error!); return resolve(''); }
    setUrl(r.data.url); resolve(r.data.url);
  }));
  const text = (u: string) => `Halo 🙏\n\nBerikut link pembayaran sertifikasi BNSP *${a.schemes?.name || ''}* atas nama *${a.full_name}* (${a.reg_code}).\nTotal: *${rupiah(a.amount)}*${a.payment_due_at ? `\nBatas bayar: ${waktu(a.payment_due_at)}` : ''}\n\n${u}\n\nBisa dibayar tanpa login (VA bank, QRIS, e-wallet). Terima kasih 🙏`;
  const sendWa = async (num: string) => {
    const w = window.open('', '_blank');
    const u = await get(); if (!u) { w?.close(); return; }
    if (w) w.location.href = `https://wa.me/${waNumber(num)}?text=${encodeURIComponent(text(u))}`;
  };
  return (
    <div className="card">
      <h2>Link bayar tanpa login</h2>
      <p className="muted small">Kirim ke peserta atau ke pihak yang membayari (HRD/perusahaan). Bisa dibayar tanpa masuk akun.</p>
      {msg && <div className="alert alert-err">{msg}</div>}
      {url && <input readOnly value={url} onFocus={e => e.target.select()} style={{ width: '100%', font: 'inherit', fontSize: 13, padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8, marginBottom: 8 }} />}
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-outline btn-sm" disabled={pending} onClick={async () => { const u = await get(); if (u) { await navigator.clipboard.writeText(u).catch(() => {}); setMsg(''); alert('Link disalin.'); } }}>📋 {url ? 'Salin link' : 'Buat & salin link'}</button>
        {a.phone && <button className="btn btn-wa btn-sm" disabled={pending} onClick={() => sendWa(a.phone)}>💬 Kirim ke peserta</button>}
      </div>
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <input value={to} onChange={e => setTo(e.target.value)} placeholder="No. WA pihak yang membayari" inputMode="tel" style={{ flex: 1, minWidth: 180, font: 'inherit', fontSize: 14, padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8 }} />
        <button className="btn btn-wa btn-sm" disabled={pending || to.replace(/\D/g, '').length < 9} onClick={() => sendWa(to)}>💬 Kirim</button>
      </div>
      <p className="muted small" style={{ marginTop: 8 }}>Mau bayar banyak peserta sekaligus? Pakai menu <a href="/admin/bayar-kolektif"><b>Bayar Kolektif</b></a>.</p>
    </div>
  );
}
