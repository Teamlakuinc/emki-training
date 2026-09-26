import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { rupiah, tanggal, jam } from '@/lib/format';
import { startApplication } from '@/app/akun/actions';
import { refCoordinatorId } from '@/lib/ref';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  return { title: `Daftar ${params.slug.replace(/-/g, ' ')}` };
}

export default async function Page({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: scheme } = await supabase.from('schemes').select('id,slug,name,price,requires_verification').eq('slug', params.slug).eq('is_active', true).maybeSingle();
  if (!scheme) notFound();
  const coord = await refCoordinatorId();
  const { data: sessions } = await supabase.rpc('available_sessions', { p_scheme_slug: scheme.slug, p_coordinator: coord });
  const prices = (sessions || []).map((x: any) => Number(x.price));
  const minP = prices.length ? Math.min(...prices) : null, maxP = prices.length ? Math.max(...prices) : null;
  const { data: { user } } = await supabase.auth.getUser();
  const dates = Array.from(new Map((sessions || []).map((s: any) => [s.schedule_id, s])).values()) as any[];
  const start = startApplication.bind(null, scheme.slug);

  return (
    <div className="grid2" style={{ alignItems: 'start' }}>
      <div>
        <span className="eyebrow">Sertifikasi Kompetensi BNSP</span>
        <h1>Pendaftaran {scheme.name}</h1>
        <p className="price">{minP == null ? 'Harga menyesuaikan jadwal' : minP === maxP ? rupiah(minP) : `Mulai ${rupiah(minP)}`}</p>
        {minP != null && minP !== maxP && <p className="muted small">Harga berbeda per lokasi/jadwal Ujikom.</p>}
        <p>Lembaga sertifikasi: <b>LSP Rajawali</b></p>
        <ol className="small" style={{ paddingLeft: 18 }}>
          <li>Pilih tanggal & sesi Ujikom</li>
          <li>Isi data diri sesuai KTP</li>
          <li>Isi data akun SIAPkerja</li>
          <li>Upload pas foto merah, QR SIAPkerja, dan PDF CV + portfolio + paklaring</li>
          {scheme.requires_verification ? <li>Tunggu verifikasi dokumen oleh tim EMKI, lalu bayar dalam 3×24 jam</li> : <li>Bayar dalam 3×24 jam setelah pendaftaran dikirim</li>}
        </ol>
        <p className="muted small">Pendaftaran bisa disimpan sebagai draft dan dilanjutkan kapan saja.</p>
      </div>
      <div className="card">
        <h2>Jadwal Ujikom tersedia</h2>
        {dates.length === 0 ? <p className="muted">Belum ada jadwal yang dibuka untuk skema ini. Anda tetap bisa membuat akun dan menyiapkan dokumen; kami akan mengabari saat jadwal dibuka.</p> : (
          <ul className="small" style={{ paddingLeft: 18 }}>
            {dates.map(d => <li key={d.schedule_id}><b>{tanggal(d.exam_date)}</b> — {d.tuk}
              <div className="muted">{(sessions as any[]).filter(s => s.schedule_id === d.schedule_id).map(s => `${s.session_name} ${jam(s.start_time)}–${jam(s.end_time)} (sisa ${s.seats_left})`).join(' · ')}</div><div className="small"><b>{rupiah((sessions as any[]).find(s => s.schedule_id === d.schedule_id)?.price)}</b></div></li>)}
          </ul>)}
        {user ? (
          <form action={start}><button className="btn btn-primary btn-block">Mulai / Lanjutkan Pendaftaran</button></form>
        ) : (
          <div className="row" style={{ marginTop: 10 }}>
            <Link className="btn btn-primary" href={`/daftar-akun?next=/daftar/${scheme.slug}`}>Buat Akun</Link>
            <Link className="btn btn-outline" href={`/masuk?next=/daftar/${scheme.slug}`}>Sudah punya akun? Masuk</Link>
          </div>
        )}
      </div>
    </div>
  );
}
