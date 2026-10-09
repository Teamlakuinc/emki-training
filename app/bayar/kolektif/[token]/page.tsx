import { notFound } from 'next/navigation';
import { groupByToken, payable } from '@/lib/paylink';
import { rupiah, tanggal, waktu, waLink, STATUS } from '@/lib/format';
import PayButton from '../../PayButton';
import BankInfo from '../../BankInfo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pembayaran Kolektif', robots: { index: false } };

export default async function Page({ params, searchParams }: { params: { token: string }; searchParams: { selesai?: string } }) {
  const data = await groupByToken(params.token);
  if (!data) notFound();
  const { g, apps } = data;
  const list = payable(apps);
  const total = list.reduce((s: number, a: any) => s + Number(a.amount), 0);
  const paid = apps.filter((a: any) => a.status === 'paid').length;
  const due = list.length ? list.map((a: any) => a.payment_due_at).sort()[0] : null;
  return (
    <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
      <span className="eyebrow">Pembayaran kolektif · {g.code}</span>
      <h1>{g.title || 'Tagihan sertifikasi'}</h1>
      {g.payer_name && <p className="muted" style={{ marginTop: -6 }}>Untuk: <b>{g.payer_name}</b></p>}
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>#</th><th>Peserta</th><th>Skema</th><th>Ujikom</th><th style={{ textAlign: 'right' }}>Biaya</th><th>Status</th></tr></thead>
        <tbody>{apps.map((a: any, i: number) => {
          const ok = list.some((x: any) => x.id === a.id);
          const st = a.status === 'paid' ? <span className="badge green">Lunas</span> : ok ? <span className="badge amber">Belum bayar</span> : <span className="badge grey">{a.status === 'awaiting_payment' ? 'Batas lewat' : STATUS[a.status]?.label || a.status}</span>;
          return <tr key={a.id}><td>{i + 1}</td><td>{a.full_name}<div className="muted small">{a.reg_code}</div></td><td className="small">{a.schemes?.name}</td>
            <td className="small">{a.exam_sessions?.exam_schedules ? tanggal(a.exam_sessions.exam_schedules.exam_date) : '-'}</td>
            <td style={{ textAlign: 'right' }}>{rupiah(a.amount)}</td><td>{st}</td></tr>; })}</tbody>
      </table></div>
      {list.length > 0 ? (<>
        <div className="row between" style={{ margin: '16px 0 6px' }}><span>Total dibayar sekarang ({list.length} peserta)</span><b style={{ fontSize: 22 }}>{rupiah(total)}</b></div>
        {due && <p className="muted small">Bayar sebelum <b>{waktu(due)}</b>. Peserta yang batas bayarnya lewat tidak ikut ditagih.</p>}
        <PayButton token={params.token} kind="group" label={`Bayar ${rupiah(total)} sekaligus`} autoCheck={!!searchParams.selesai} />
        <BankInfo amount={total} label={g.code} waText={`Halo admin EMKI, berikut bukti transfer tagihan kolektif ${g.code} (${list.length} peserta) sebesar ${rupiah(total)}.`} />
      </>) : (
        <div className="alert alert-ok" style={{ marginTop: 16 }}>{paid === apps.length ? '✅ Semua peserta sudah lunas. Terima kasih!' : 'Tidak ada peserta yang perlu dibayar saat ini. Hubungi admin jika ada yang batas bayarnya lewat.'}</div>
      )}
      <p className="small" style={{ marginTop: 16 }}><a href={waLink(`Halo admin EMKI, saya mau tanya tagihan kolektif ${g.code}.`)} target="_blank" rel="noopener">Butuh bantuan? Hubungi admin via WhatsApp</a></p>
    </div>
  );
}
