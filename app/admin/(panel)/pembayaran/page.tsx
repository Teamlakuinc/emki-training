import { requireStaff } from '@/lib/admin';
import { rupiah, waktu } from '@/lib/format';
import ReviewProof from '@/components/admin/ReviewProof';

export default async function Page() {
  const { supabase } = await requireStaff();
  const [{ data: pending }, { data: done }] = await Promise.all([
    supabase.from('payment_proofs').select('*, applications(id,reg_code,full_name,schemes!applications_scheme_id_fkey(name))').eq('status', 'pending').order('created_at'),
    supabase.from('payment_proofs').select('id,status,amount,sender_name,reviewed_at,review_note,applications(id,full_name,reg_code),profiles(full_name,email)').neq('status', 'pending').order('reviewed_at', { ascending: false }).limit(20),
  ]);
  // bukti kolektif: tampilkan satu kartu per transfer
  const seen = new Set<string>();
  const list = (pending || []).filter((p: any) => { if (!p.group_code) return true; const k = p.group_code + p.storage_path; if (seen.has(k)) return false; seen.add(k); return true; });
  const urls: Record<string, string> = {};
  for (const p of list) { const { data } = await supabase.storage.from('application-documents').createSignedUrl(p.storage_path, 900); if (data) urls[p.id] = data.signedUrl; }
  return (
    <>
      <h1>Konfirmasi pembayaran</h1>
      {!list.length && <div className="card center"><p>✅ Tidak ada bukti transfer yang menunggu konfirmasi.</p></div>}
      {list.map((p: any) => <ReviewProof key={p.id} p={p} url={urls[p.id] || null} />)}
      <h2 style={{ marginTop: 28 }}>Riwayat terakhir</h2>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Peserta</th><th>Nominal</th><th>Pengirim</th><th>Hasil</th><th>Oleh</th><th>Waktu</th></tr></thead>
        <tbody>{(done || []).map((p: any) => <tr key={p.id}><td><a href={`/admin/pendaftar/${p.applications?.id}`}>{p.applications?.full_name}</a></td><td>{rupiah(p.amount)}</td><td>{p.sender_name}</td>
          <td>{p.status === 'approved' ? <span className="badge green">Dikonfirmasi</span> : <span className="badge red" title={p.review_note}>Ditolak</span>}</td><td className="small">{p.profiles?.full_name || p.profiles?.email}</td><td className="small">{waktu(p.reviewed_at)}</td></tr>)}
          {!done?.length && <tr><td colSpan={6} className="muted">Belum ada.</td></tr>}</tbody></table></div>
    </>
  );
}
