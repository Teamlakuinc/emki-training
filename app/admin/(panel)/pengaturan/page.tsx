import { requireStaff } from '@/lib/admin';
import { dokuReady } from '@/lib/doku';

export default async function Page() {
  await requireStaff('super');
  const ready = dokuReady(); const prod = process.env.DOKU_IS_PRODUCTION === 'true';
  return (<>
    <h1>Pengaturan pembayaran</h1>
    <div className="card">
      <h2>DOKU Checkout</h2>
      <dl className="kv">
        <dt>Status kunci</dt><dd>{ready ? <span className="badge green">Terpasang</span> : <span className="badge red">Belum diisi di server</span>}</dd>
        <dt>Mode</dt><dd>{prod ? <span className="badge green">Production (uang asli)</span> : <span className="badge amber">Sandbox (uji coba)</span>}</dd>
        <dt>Notification URL</dt><dd><code>{(process.env.NEXT_PUBLIC_SITE_URL || '') + '/api/doku/notification'}</code></dd>
      </dl>
      <p className="muted small" style={{ marginTop: 12 }}>Semua pembayaran peserta otomatis melalui DOKU (VA, QRIS, e-wallet, kartu). Status lunas berubah otomatis dari notifikasi DOKU. Kunci & mode diatur di file .env.local di server.</p>
    </div>
  </>);
}
