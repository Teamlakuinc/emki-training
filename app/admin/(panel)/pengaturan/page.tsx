import { requireStaff, paymentMethod } from '@/lib/admin';
import { dokuReady } from '@/lib/doku';
import PaymentSettings from '@/components/admin/PaymentSettings';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { supabase } = await requireStaff('super');
  const ready = dokuReady(); const prod = process.env.DOKU_IS_PRODUCTION === 'true';
  const [method, { data: banks }] = await Promise.all([paymentMethod(), supabase.from('bank_accounts').select('*').order('sort_order')]);
  return (<>
    <h1>Pengaturan pembayaran</h1>
    <PaymentSettings method={method} banks={banks || []} dokuReady={ready} />
    <div className="card" style={{ marginTop: 24 }}>
      <h2>DOKU Checkout</h2>
      <dl className="kv">
        <dt>Status kunci</dt><dd>{ready ? <span className="badge green">Terpasang</span> : <span className="badge red">Belum diisi di server</span>}</dd>
        <dt>Mode</dt><dd>{prod ? <span className="badge green">Production (uang asli)</span> : <span className="badge amber">Sandbox (uji coba)</span>}</dd>
      </dl>
      <p className="muted small" style={{ marginTop: 12 }}>Pembayaran DOKU lunas otomatis. Transfer manual dikonfirmasi tim di menu <b>Konfirmasi Pembayaran</b>.</p>
    </div>
  </>);
}
