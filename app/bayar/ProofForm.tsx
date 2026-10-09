'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { proofUrl, sendProof } from './actions';

/** Form upload bukti transfer (tanpa login). */
export default function ProofForm({ token, kind, defaultName }: { token: string; kind: 'app' | 'group'; defaultName?: string }) {
  const router = useRouter();
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const [f, setF] = useState({ sender_name: defaultName || '', sender_bank: '', transfer_date: today });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState('');
  const inp = { width: '100%', font: 'inherit', padding: '9px 11px', border: '1.5px solid #D5D8DC', borderRadius: 8 } as const;
  async function send(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!file) return setErr('Pilih file bukti transfer.');
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) return setErr('Format bukti harus JPG, PNG, atau PDF.');
    if (file.size > 10 * 1024 * 1024) return setErr('Ukuran file maksimal 10 MB.');
    setBusy(true);
    try {
      const u: any = await proofUrl(kind, token, file.type, file.size);
      if (!u.ok) return setErr(u.error);
      const { error } = await createClient().storage.from('application-documents').uploadToSignedUrl(u.path, u.uploadToken, file, { contentType: file.type });
      if (error) return setErr('Upload gagal: ' + error.message);
      const r: any = await sendProof(kind, token, { path: u.path, name: file.name, mime: file.type, size: file.size, ...f });
      if (!r.ok) return setErr(r.error);
      setDone(kind === 'group' ? `Bukti transfer untuk ${r.count} peserta terkirim.` : 'Bukti transfer terkirim.'); router.refresh();
    } catch { setErr('Koneksi terputus. Coba lagi.'); } finally { setBusy(false); }
  }
  if (done) return <div className="alert alert-ok" style={{ marginTop: 10 }}>✅ {done} Tim EMKI akan mengecek dan mengonfirmasi. Status berubah menjadi Lunas setelah dikonfirmasi.</div>;
  return (
    <form onSubmit={send} style={{ marginTop: 12 }}>
      <div className="lbl" style={{ marginBottom: 6 }}>Sudah transfer? Upload bukti di sini</div>
      <div className="grid2">
        <div className="field"><label className="small">Nama pengirim (sesuai rekening)</label><input required value={f.sender_name} onChange={e => setF({ ...f, sender_name: e.target.value })} style={inp} /></div>
        <div className="field"><label className="small">Bank pengirim</label><input required placeholder="mis. BCA, Mandiri, BRI" value={f.sender_bank} onChange={e => setF({ ...f, sender_bank: e.target.value })} style={inp} /></div>
        <div className="field"><label className="small">Tanggal transfer</label><input type="date" required max={today} value={f.transfer_date} onChange={e => setF({ ...f, transfer_date: e.target.value })} style={inp} /></div>
        <div className="field"><label className="small">Bukti transfer (JPG/PNG/PDF, maks. 10 MB)</label><input type="file" required accept="image/jpeg,image/png,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ ...inp, padding: 7 }} /></div>
      </div>
      {err && <div className="alert alert-err">{err}</div>}
      <button className="btn btn-green" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim bukti transfer'}</button>
    </form>
  );
}
