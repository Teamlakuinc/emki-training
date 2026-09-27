import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { rupiah, tanggal, jam } from '@/lib/format';
import { refCoordinatorId } from '@/lib/ref';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Jadwal Ujikom' };

export default async function Page() {
  const supabase = createClient();
  const coord = await refCoordinatorId();
  const { data: schemes } = await supabase.from('schemes').select('slug,name,level_order').eq('is_active', true).order('level_order');
  const rows: any[] = [];
  await Promise.all((schemes || []).map(async sc => {
    const { data } = await supabase.rpc('available_sessions', { p_scheme_slug: sc.slug, p_coordinator: coord });
    (data || []).forEach((r: any) => rows.push({ ...r, slug: sc.slug, scheme: sc.name, lvl: sc.level_order }));
  }));
  const byDate = new Map<string, any>();
  rows.forEach(r => {
    const g = byDate.get(r.schedule_id) || { ...r, sessions: new Map(), schemes: new Map() };
    g.sessions.set(r.session_id, r);
    const cur = g.schemes.get(r.slug);
    g.schemes.set(r.slug, { slug: r.slug, name: r.scheme, lvl: r.lvl, price: r.price, left: (cur?.left || 0) + Math.max(r.seats_left, 0) });
    byDate.set(r.schedule_id, g);
  });
  const groups = Array.from(byDate.values()).sort((a, b) => a.exam_date.localeCompare(b.exam_date));
  return (
    <>
      <span className="eyebrow">Sertifikasi Kompetensi BNSP · LSP Rajawali Hospitality Nusantara</span>
      <h1>Jadwal Uji Kompetensi</h1>
      <p className="muted">Pilih jadwal dan lokasi, lalu klik skema yang ingin Anda ikuti. Harga yang tampil adalah harga final untuk jadwal tersebut.</p>
      {groups.length === 0 && <div className="card center"><p>Belum ada jadwal yang dibuka. Hubungi admin untuk info jadwal berikutnya.</p></div>}
      {groups.map(g => (
        <div className="card" key={g.schedule_id}>
          <h2 style={{ marginBottom: 2 }}>{tanggal(g.exam_date)}</h2>
          <div className="muted">{g.tuk}{g.address ? ` — ${g.address}` : ''}</div>
          <div className="muted small" style={{ margin: '6px 0 12px' }}>Sesi: {Array.from(g.sessions.values()).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time)).map((s: any) => `${s.session_name} ${jam(s.start_time)}–${jam(s.end_time)}`).join(' · ')}</div>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Skema</th><th>Harga</th><th>Sisa kursi</th><th></th></tr></thead><tbody>
            {Array.from(g.schemes.values()).sort((a: any, b: any) => a.lvl - b.lvl).map((s: any) => (
              <tr key={s.slug}><td><b>{s.name}</b></td><td>{rupiah(s.price)}</td><td>{s.left > 0 ? s.left : <span className="badge red">Penuh</span>}</td>
                <td>{s.left > 0 && <Link className="btn btn-primary btn-sm" href={`/daftar/${s.slug}`}>Pilih & daftar</Link>}</td></tr>))}
          </tbody></table></div>
        </div>
      ))}
    </>
  );
}
