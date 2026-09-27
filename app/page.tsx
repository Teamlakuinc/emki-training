import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { rupiah } from '@/lib/format';
import { refCoordinatorId } from '@/lib/ref';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createClient();
  const { data: schemes } = await supabase.from('schemes')
    .select('slug,name,requires_verification,level_order').eq('is_active', true).order('level_order');
  const coord = await refCoordinatorId();
  const mins: Record<string, number | null> = {};
  await Promise.all((schemes || []).map(async s => {
    const { data } = await supabase.rpc('available_sessions', { p_scheme_slug: s.slug, p_coordinator: coord });
    const ps = (data || []).map((x: any) => Number(x.price)); mins[s.slug] = ps.length ? Math.min(...ps) : null;
  }));
  return (
    <>
      <span className="eyebrow">Sertifikasi Kompetensi BNSP · LSP Rajawali Hospitality Nusantara</span>
      <h1>Pilih skema sertifikasi</h1>
      <p className="muted">Pilih skema untuk mulai mendaftar. Informasi lengkap tiap skema ada di <a href="https://edukasikuliner.com/sertifikasi/">edukasikuliner.com/sertifikasi</a>.</p>
      <div className="grid2" style={{ marginTop: 20 }}>
        {(schemes || []).map(s => (
          <div className="card" key={s.slug}>
            <h2>{s.name}</h2>
            <p className="price">{mins[s.slug] != null ? `Mulai ${rupiah(mins[s.slug])}` : 'Jadwal segera dibuka'}</p>
            <p className="muted small">{s.requires_verification ? 'Dokumen diverifikasi tim EMKI sebelum pembayaran.' : 'Isi data & dokumen, lalu langsung bayar.'}</p>
            <Link className="btn btn-primary" href={`/daftar/${s.slug}`}>Daftar {s.name}</Link>
          </div>
        ))}
      </div>
    </>
  );
}
