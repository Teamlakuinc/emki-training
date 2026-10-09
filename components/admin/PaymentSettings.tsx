'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePaymentMethod, saveBank, deleteBank } from '@/app/admin/actions';

const inp = { style: { font: 'inherit', fontSize: 14, padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8, width: '100%' } } as const;

export default function PaymentSettings({ method, banks, dokuReady }: { method: string; banks: any[]; dokuReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [m, setM] = useState(method);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const done = (r: any, ok: string) => { setMsg(r.ok ? { t: 'ok', m: ok } : { t: 'err', m: r.error }); if (r.ok) router.refresh(); };
  const Bank = ({ b }: { b?: any }) => (
    <form className="card" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget; start(async () => { const r = await saveBank(f); done(r, 'Rekening tersimpan.'); if (r.ok && !b) form.reset(); }); }}>
      {b && <input type="hidden" name="id" value={b.id} />}
      {!b && <h3>Tambah rekening</h3>}
      <div className="grid2">
        <div className="field"><label>Bank</label><input name="bank" defaultValue={b?.bank} placeholder="mis. BCA" required {...inp} /></div>
        <div className="field"><label>Nomor rekening</label><input name="account_number" defaultValue={b?.account_number} inputMode="numeric" required {...inp} /></div>
      </div>
      <div className="grid2">
        <div className="field"><label>Atas nama</label><input name="account_name" defaultValue={b?.account_name} required {...inp} /></div>
        <div className="field"><label>Urutan</label><input name="sort_order" type="number" defaultValue={b?.sort_order ?? 1} {...inp} /></div>
      </div>
      <div className="row between"><label className="check small"><input type="checkbox" name="is_active" defaultChecked={b?.is_active ?? true} />Tampilkan ke peserta</label>
        <span className="row">{b && <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => { if (confirm('Hapus rekening ini?')) start(async () => done(await deleteBank(b.id), 'Dihapus.')); }}>Hapus</button>}
          <button className="btn btn-primary btn-sm" disabled={pending}>{b ? 'Simpan' : 'Tambah rekening'}</button></span></div>
    </form>);
  return (
    <>
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
      <div className="card">
        <h2>Metode pembayaran</h2>
        {[['doku', 'DOKU saja (otomatis)', 'VA bank, QRIS, e-wallet, kartu; lunas otomatis.' + (dokuReady ? '' : ' ⚠️ Kunci DOKU belum diisi di server.')],
          ['manual', 'Transfer manual saja', 'Peserta transfer ke rekening di bawah lalu upload bukti; tim mengonfirmasi di menu Konfirmasi Pembayaran.'],
          ['both', 'Keduanya (disarankan)', 'Peserta memilih: bayar online via DOKU, atau transfer manual ke rekening + upload bukti.']].map(([k, t, d]) => (
          <label key={k} className="check" style={{ border: '1.5px solid var(--line)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, background: m === k ? 'var(--blue-soft)' : '#fff' }}>
            <input type="radio" name="pm" checked={m === k} onChange={() => setM(k)} /><span><b>{t}</b><br /><span className="muted small">{d}</span></span></label>))}
        <button className="btn btn-primary btn-sm" disabled={pending || m === method} onClick={() => start(async () => done(await savePaymentMethod(m), 'Metode pembayaran disimpan.'))}>Simpan metode</button>
      </div>
      <h2 style={{ marginTop: 24 }}>Rekening tujuan transfer</h2>
      <p className="muted small">Sebaiknya rekening atas nama lembaga/yayasan agar peserta lebih percaya.</p>
      {banks.map(b => <Bank key={b.id} b={b} />)}
      <Bank />
    </>
  );
}
