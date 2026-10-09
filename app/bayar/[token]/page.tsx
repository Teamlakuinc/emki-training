import { notFound } from 'next/navigation';
import { appByToken } from '@/lib/paylink';
import { rupiah, tanggal, waktu, jam, waLink } from '@/lib/format';
import PayButton from '../PayButton';
import BankInfo from '../BankInfo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pembayaran Sertifikasi', robots: { index: false } };

export default async function Page({ params, searchParams }: { params: { token: string }; searchParams: { selesai?: string } }) {
  const a: any = await appByToken(params.token);
  if (!a) notFound();
  const s = a.exam_sessions, j = s?.exam_schedules;
  const lewat = a.status === 'awaiting_payment' && a.payment_due_at && new Date(a.payment_due_at).getTime() < Date.now();
  return (
    <div className="card narrow" style={{ margin: '0 auto' }}>
      <span className="eyebrow">Pembayaran sertifikasi</span>
      <h1>{a.full_name}</h1>
      <dl className="kv">
        <dt>No. registrasi</dt><dd>{a.reg_code}</dd>
        <dt>Skema</dt><dd>{a.schemes?.name}</dd>
        {j && <><dt>Jadwal Ujikom</dt><dd>{tanggal(j.exam_date)} · {s.name} ({jam(s.start_time)}–{jam(s.end_time)})<br />{j.tuk}</dd></>}
        <dt>Total</dt><dd><b style={{ fontSize: 20 }}>{rupiah(a.amount)}</b></dd>
        {a.status === 'awaiting_payment' && a.payment_due_at && <><dt>Batas bayar</dt><dd>{waktu(a.payment_due_at)}</dd></>}
      </dl>
      {a.status === 'payment_review' ? (
        <div className="alert alert-info">🧾 <b>Bukti transfer sudah diterima</b> dan sedang dicek tim EMKI. Status berubah menjadi Lunas setelah dikonfirmasi.</div>
      ) : a.status === 'paid' ? (
        <div className="alert alert-ok">✅ <b>Lunas</b>{a.paid_at ? ` pada ${waktu(a.paid_at)}` : ''}. Terima kasih! Informasi Ujikom dikirim ke peserta.</div>
      ) : a.status === 'awaiting_payment' && !lewat ? (<>
        <p className="muted small">Pembayaran melalui DOKU (transfer bank / virtual account, QRIS, e-wallet, kartu). Siapa pun boleh membayar lewat link ini.</p>
        <PayButton token={params.token} kind="app" label={`Bayar ${rupiah(a.amount)}`} autoCheck={!!searchParams.selesai} />
        <BankInfo token={params.token} kind="app" defaultName={a.full_name} amount={Number(a.amount)} label={a.reg_code} waText={`Halo admin EMKI, berikut bukti transfer untuk ${a.reg_code} (${a.full_name}) sebesar ${rupiah(a.amount)}.`} />
      </>) : (
        <div className="alert alert-warn">{lewat || a.status === 'expired' ? 'Batas pembayaran sudah lewat.' : 'Pendaftaran ini belum/tidak sedang menunggu pembayaran.'} Silakan hubungi admin EMKI.</div>
      )}
      <p className="small" style={{ marginTop: 16 }}><a href={waLink(`Halo admin EMKI, saya mau tanya pembayaran ${a.reg_code} (${a.full_name}).`)} target="_blank" rel="noopener">Butuh bantuan? Hubungi admin via WhatsApp</a></p>
    </div>
  );
}
