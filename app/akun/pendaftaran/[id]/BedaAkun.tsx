import Link from 'next/link';
import { waLink } from '@/lib/format';

export default function BedaAkun({ id, ownerMasked, myEmail }: { id: string; ownerMasked: string; myEmail: string }) {
  const next = `/akun/pendaftaran/${id}`;
  return (
    <div className="card narrow" style={{ margin: '0 auto' }}>
      <span className="eyebrow">Beda akun</span>
      <h1>Pendaftaran ini ada di akun lain</h1>
      <div className="alert alert-warn">
        Anda sedang masuk sebagai <b>{myEmail}</b>, sedangkan pendaftaran ini terdaftar di akun <b>{ownerMasked || 'lain'}</b>.
      </div>
      <p className="muted">Keluar dulu, lalu masuk dengan email tersebut. Data dan dokumen Anda tetap aman, tidak perlu mendaftar ulang.</p>
      <a className="btn btn-primary btn-block" href={`/keluar?next=${encodeURIComponent(next)}`}>Keluar &amp; masuk dengan akun yang benar</a>
      <p className="small" style={{ marginTop: 16 }}>Lupa password akun tersebut? <Link href="/lupa-password">Atur ulang password</Link></p>
      <p className="small">Masih bingung? <a href={waLink(`Halo admin EMKI, saya tidak bisa membuka pendaftaran saya (ID ${id.slice(0, 8)}). Saya masuk dengan email ${myEmail}.`)} target="_blank" rel="noopener">Hubungi admin via WhatsApp</a></p>
    </div>
  );
}
