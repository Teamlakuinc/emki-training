'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewPayment } from '@/app/admin/actions';
import { rupiah, tanggal, waktu } from '@/lib/format';

export default function ReviewProof({ p, url }: { p: any; url: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(''); const [rej, setRej] = useState(false);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const a = p.applications;
  const isPdf = p.mime_type === 'application/pdf';
  const act = (approve: boolean) => start(async () => {
    const r = await reviewPayment(p.id, approve, note);
    if (!r.ok) return setMsg({ t: 'err', m: r.error! });
    setMsg({ t: 'ok', m: approve ? 'Dikonfirmasi LUNAS. Email terkirim ke peserta.' : 'Ditolak. Peserta diminta upload ulang.' }); router.refresh();
  });
  return (
    <div className="card">
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}><a href={`/admin/pendaftar/${a?.id}`}>{a?.full_name}</a></h2>
          <div className="muted small">{a?.reg_code} · {a?.schemes?.name}</div>
          {p.group_code && <div className="alert alert-info small" style={{ marginTop: 8 }}>👥 <b>Transfer kolektif {p.group_code}</b>: total {rupiah(p.total_amount)} untuk beberapa peserta. Konfirmasi/tolak di sini berlaku untuk <b>semua peserta</b> dalam transfer ini.</div>}
          {p.via_link && !p.group_code && <div className="muted small">Dikirim lewat link bayar tanpa login.</div>}
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>Harus dibayar</dt><dd><b style={{ fontSize: 18 }}>{rupiah(p.amount)}</b></dd>
            <dt>Nama pengirim</dt><dd>{p.sender_name}</dd>
            <dt>Bank pengirim</dt><dd>{p.sender_bank}</dd>
            <dt>Tanggal transfer</dt><dd>{tanggal(p.transfer_date)}</dd>
            <dt>Dikirim</dt><dd>{waktu(p.created_at)}</dd>
          </dl>
          <p className="small muted" style={{ marginTop: 10 }}>Cocokkan dengan mutasi rekening (nominal, nama, tanggal) sebelum mengonfirmasi.</p>
          {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
          {!rej ? <div className="row">
            <button className="btn btn-green" disabled={pending} onClick={() => { if (confirm(`Konfirmasi pembayaran ${rupiah(p.group_code ? p.total_amount : p.amount)} dari ${p.sender_name} sudah masuk?`)) act(true); }}>✅ Konfirmasi lunas</button>
            <button className="btn btn-danger" disabled={pending} onClick={() => setRej(true)}>❌ Tolak</button></div>
          : <div><div className="field"><label>Alasan penolakan (dikirim ke peserta)</label><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="mis. Nominal kurang Rp 50.000 / bukti tidak terbaca / dana belum masuk" style={{ width: '100%', font: 'inherit', padding: 8, border: '1.5px solid #D5D8DC', borderRadius: 8 }} /></div>
            <div className="row"><button className="btn btn-danger" disabled={pending || !note.trim()} onClick={() => act(false)}>Kirim penolakan</button><button className="btn btn-outline btn-sm" onClick={() => setRej(false)}>Batal</button></div></div>}
        </div>
        <div>{url ? (isPdf ? <a className="btn btn-outline" href={url} target="_blank" rel="noopener">Buka bukti (PDF)</a>
          : <a href={url} target="_blank" rel="noopener"><img src={url} alt="Bukti transfer" style={{ width: '100%', maxHeight: 460, objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }} /></a>) : <p className="muted">File tidak dapat dimuat.</p>}</div>
      </div>
    </div>
  );
}
