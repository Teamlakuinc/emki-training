import Link from 'next/link';
import { requireStaff, isAdminRole } from '@/lib/admin';
import { STATUS, rupiah } from '@/lib/format';
import { RepriceAllButton, RepriceOneButton } from '@/components/admin/RepriceButtons';

export default async function Page() {
  const { supabase, role } = await requireStaff();
  const { data } = await supabase.rpc('admin_price_mismatches');
  const rows = (data as any[]) || [];
  const admin = isAdminRole(role);
  return (<>
    <h1>Cek harga tagihan</h1>
    <p className="muted">Daftar peserta yang <b>belum membayar</b> dan tagihannya berbeda dari harga yang berlaku sekarang (skema + jadwal + koordinator). Biasanya karena harga/markup diubah setelah peserta mengirim pendaftaran. Peserta yang sudah lunas tidak diubah.</p>
    {admin && <div style={{ margin: '12px 0' }}><RepriceAllButton count={rows.length} /></div>}
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Peserta</th><th>Koordinator</th><th>Status</th><th>Ditagihkan</th><th>Seharusnya</th><th></th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.application_id}><td><Link href={`/admin/pendaftar/${r.application_id}`}>{r.full_name}</Link><div className="muted small">{r.reg_code}</div></td>
        <td>{r.koordinator || '—'}</td><td><span className={`badge ${STATUS[r.status].tone}`}>{STATUS[r.status].label}</span></td>
        <td>{rupiah(r.ditagihkan)}</td><td><b>{rupiah(r.seharusnya)}</b></td><td>{admin && <RepriceOneButton id={r.application_id} />}</td></tr>)}
        {!rows.length && <tr><td colSpan={6} className="muted">✅ Semua tagihan sudah sesuai.</td></tr>}</tbody></table></div>
  </>);
}
