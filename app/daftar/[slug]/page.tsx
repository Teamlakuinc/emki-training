import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { rupiah, tanggal, jam } from '@/lib/format';
import { startApplication } from '@/app/akun/actions';
import { refCoordinatorId } from '@/lib/ref';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  return { title: `Jadwal & pendaftaran ${params.slug.replace(/-/g, ' ')}` };
}

export default async function Page({ params, searchParams }: { params: { slug: string }; searchParams: { sesi?: string } }) {
  const supabase = createClient();
  const { data: scheme } = await supabase.from('schemes').select('id,slug,name,requires_verification').eq('slug', params.slug).eq('is_active', true).maybeSingle();
  if (!scheme) notFound();
  const coord = await refCoordinatorId();
  const { data: sessions } = await supabase.rpc('available_sessions', { p_scheme_slug: scheme.slug, p_coordinator: coord });
  const { data: { user } } = await supabase.auth.getUser();
  const list = (sessions || []) as any[];
  const groups = Array.from(new Map(list.map(s => [s.schedule_id, s])).values());
  const start = startApplication.bind(null, scheme.slug);
  const back = (sid?: string) => `/daftar/${scheme.slug}${sid ? `?sesi=${sid}` : ''}`;

  const SessionAction = ({ s }: { s: any }) => {
    const full = s.seats_left <= 0;
    if (full) return <span className="badge red">Penuh</span>;
    if (user) return (
      <form action={start}><input type="hidden" name="session_id" value={s.session_id} />
        <button className={`btn btn-sm ${searchParams.sesi === s.session_id ? 'btn-green' : 'btn-primary'}`}>{searchParams.sesi === s.session_id ? 'Lanjutkan dengan sesi ini →' : 'Pilih sesi ini'}</button></form>);
    return <Link className="btn btn-primary btn-sm" href={`/daftar-akun?next=${encodeURIComponent(back(s.session_id))}`}>Pilih sesi ini</Link>;
  };

  return (
    <>
      <a href="https://edukasikuliner.com/sertifikasi/" className="small">← Semua skema sertifikasi</a>
      <div className="row between" style={{ margin: '8px 0 18px', alignItems: 'flex-end' }}>
        <div>
          <span className="eyebrow">Sertifikasi Kompetensi BNSP · LSP Rajawali Hospitality Nusantara</span>
          <h1 style={{ marginBottom: 4 }}>Jadwal & pendaftaran {scheme.name}</h1>
          <p className="muted" style={{ margin: 0 }}>Pilih tanggal, lokasi, dan sesi Ujikom. Harga yang tampil adalah harga final.</p>
        </div>
        <Link href="/jadwal" className="btn btn-outline btn-sm">Lihat jadwal semua skema</Link>
      </div>

      {!user && (
        <div className="alert alert-info">Setelah memilih sesi, Anda akan diminta <b>membuat akun</b> (atau <Link href={`/masuk?next=${encodeURIComponent(back(searchParams.sesi))}`}>masuk</Link> jika sudah punya) untuk menyimpan pendaftaran.</div>
      )}
      {user && searchParams.sesi && <div className="alert alert-ok">Sesi pilihan Anda ditandai hijau. Klik <b>Lanjutkan dengan sesi ini</b> untuk mengisi formulir.</div>}

      {groups.length === 0 ? (
        <div className="card center">
          <h2>Belum ada jadwal yang dibuka</h2>
          <p className="muted">Jadwal Ujikom {scheme.name} berikutnya sedang disiapkan. Anda tetap bisa membuat akun dan menyiapkan dokumen lebih dulu.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            {user ? <form action={start}><button className="btn btn-primary">Mulai isi formulir</button></form>
                  : <Link className="btn btn-primary" href={`/daftar-akun?next=${encodeURIComponent(back())}`}>Buat akun</Link>}
            <a className="btn btn-outline" href={`https://wa.me/${process.env.NEXT_PUBLIC_WA_ADMIN || '6285117575842'}?text=${encodeURIComponent(`Halo EMKI, saya ingin info jadwal Ujikom ${scheme.name} berikutnya.`)}`} target="_blank" rel="noopener">Tanya jadwal via WhatsApp</a>
          </div>
        </div>
      ) : groups.map(g => {
        const ss = list.filter(s => s.schedule_id === g.schedule_id);
        const left = ss.reduce((n, s) => n + Math.max(s.seats_left, 0), 0);
        return (
          <div className="card" key={g.schedule_id}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ marginBottom: 2 }}>{tanggal(g.exam_date)}</h2>
                <div className="muted">{g.tuk}{g.address ? ` — ${g.address}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}><div className="price">{rupiah(ss[0].price)}</div><div className="muted small">{left > 0 ? `Sisa ${left} kursi` : 'Penuh'}</div></div>
            </div>
            {ss.map(s => (
              <div key={s.session_id} className={`sess ${searchParams.sesi === s.session_id ? 'sel' : ''} ${s.seats_left <= 0 ? 'full' : ''}`} style={{ cursor: 'default' }}>
                <span><b>{s.session_name}</b> · {jam(s.start_time)}–{jam(s.end_time)} WIB <span className={`badge ${s.seats_left <= 0 ? 'red' : s.seats_left <= 3 ? 'amber' : 'green'}`} style={{ marginLeft: 6 }}>{s.seats_left <= 0 ? 'Penuh' : `Sisa ${s.seats_left}`}</span></span>
                <SessionAction s={s} />
              </div>
            ))}
          </div>
        );
      })}

      <div className="card" style={{ background: 'var(--panel)' }}>
        <h3>Alur setelah memilih sesi</h3>
        <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Isi data diri sesuai KTP & data akun SIAPkerja</li>
          <li>Upload dokumen (pas foto merah, QR SIAPkerja, CV + portfolio + paklaring)</li>
          {scheme.requires_verification ? <li>Tim EMKI memverifikasi dokumen, lalu Anda membayar dalam 3×24 jam</li> : <li>Bayar online dalam 3×24 jam — kursi ditahan selama itu</li>}
          <li>Terima konfirmasi & jadwal lewat email dan WhatsApp</li>
        </ol>
        <p className="muted small" style={{ margin: '8px 0 0' }}>Formulir tersimpan otomatis sebagai draft — bisa dilanjutkan kapan saja.</p>
      </div>
    </>
  );
}
