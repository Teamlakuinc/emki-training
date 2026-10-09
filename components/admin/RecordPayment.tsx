'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { adminProofUploadUrl, adminRecordPayment } from '@/app/admin/actions';
import { rupiah } from '@/lib/format';

/** Admin upload bukti transfer (mis. diterima lewat WA) → langsung Lunas. */
export default function RecordPayment({ target, amount, label, defaultName, compact }: { target: { appId?: string; groupId?: string }; amount: number; label: string; defaultName?: string; compact?: boolean }) {
  const router = useRouter();
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const [open, setOpen] = useState(!compact);
  const [f, setF] = useState({ sender_name: defaultName || '', sender_bank: '', transfer_date: today, note: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const inp = { width: '100%', font: 'inherit', fontSize: 14, padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8 } as const;
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!file) return setMsg({ t: 'err', m: 'Pilih file bukti transfer.' });
    if (!confirm(`Catat pembayaran ${rupiah(amount)} untuk ${label} dan tandai LUNAS?`)) return;
    setBusy(true);
    try {
      const u = await adminProofUploadUrl(target, file.type, file.size);
      if (!u.ok) return setMsg({ t: 'err', m: u.error! });
      const { error } = await createClient().storage.from('application-documents').uploadToSignedUrl(u.data.path, u.data.token, file, { contentType: file.type });
      if (error) return setMsg({ t: 'err', m: 'Upload gagal: ' + error.message });
      const r = await adminRecordPayment(target, { path: u.data.path, name: file.name, mime: file.type, size: file.size, ...f });
      if (!r.ok) return setMsg({ t: 'err', m: r.error! });
      setMsg({ t: 'ok', m: `✅ ${r.data.count} peserta ditandai LUNAS (${rupiah(r.data.total)}). Email lunas terkirim.` }); setFile(null); router.refresh();
    } catch { setMsg({ t: 'err', m: 'Koneksi terputus. Coba lagi.' }); } finally { setBusy(false); }
  }
  if (!open) return <button className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>🧾 Upload bukti & tandai lunas</button>;
  return (
    <form onSubmit={save} style={compact ? { marginTop: 8, padding: 12, border: '1px dashed var(--line)', borderRadius: 10 } : undefined}>
      {msg && <div className={`alert alert-${msg.t}`}>{msg.m}</div>}
      <div className="grid2">
        <input required placeholder="Nama pengirim (sesuai rekening)" value={f.sender_name} onChange={e => setF({ ...f, sender_name: e.target.value })} style={inp} />
        <input required placeholder="Bank pengirim, mis. BCA" value={f.sender_bank} onChange={e => setF({ ...f, sender_bank: e.target.value })} style={inp} />
        <input type="date" required max={today} value={f.transfer_date} onChange={e => setF({ ...f, transfer_date: e.target.value })} style={inp} />
        <input type="file" required accept="image/jpeg,image/png,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ ...inp, padding: 6 }} />
      </div>
      <input placeholder="Catatan (opsional), mis. diterima via WA HRD" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} style={{ ...inp, marginTop: 8 }} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn btn-green btn-sm" disabled={busy}>{busy ? 'Menyimpan…' : `Simpan & tandai LUNAS (${rupiah(amount)})`}</button>
        {compact && <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Batal</button>}
      </div>
      <p className="muted small" style={{ margin: '6px 0 0' }}>Pastikan dana sudah masuk ke rekening (cek mutasi) sebelum menyimpan.</p>
    </form>
  );
}
