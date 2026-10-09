import { createAdminClient } from '@/lib/supabase/admin';
import { rupiah, waLink } from '@/lib/format';
import ProofForm from './ProofForm';

/** Info rekening untuk transfer manual dari halaman bayar tanpa login. */
export default async function BankInfo({ amount, label, waText, token, kind, defaultName }: { amount: number; label: string; waText: string; token: string; kind: 'app' | 'group'; defaultName?: string }) {
  const db = createAdminClient();
  const [{ data: set }, { data: banks }] = await Promise.all([
    db.from('app_settings').select('value').eq('key', 'payment_method').maybeSingle(),
    db.from('bank_accounts').select('bank,account_number,account_name').eq('is_active', true).order('sort_order'),
  ]);
  const m = String(set?.value ?? '').replace(/"/g, '');
  if (!(m === 'manual' || m === 'both') || !banks?.length) return null;
  return (
    <div style={{ marginTop: 18, borderTop: '1px dashed var(--line)', paddingTop: 14 }}>
      <div className="lbl">{m === 'both' ? 'Atau transfer manual' : 'Transfer ke rekening'} ({label})</div>
      {banks.map((b: any) => (
        <div key={b.account_number} className="doc-link"><span><b>{b.bank}</b> · <span style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>{b.account_number}</span><div className="muted small">a.n. {b.account_name}</div></span></div>))}
      <p className="small" style={{ margin: '8px 0' }}>Nominal: <b>{rupiah(amount)}</b> (mohon transfer tepat sesuai nominal).</p>
      <ProofForm token={token} kind={kind} defaultName={defaultName} />
      <p className="muted small" style={{ marginTop: 8 }}>Kesulitan upload? <a href={waLink(waText)} target="_blank" rel="noopener">Kirim bukti lewat WhatsApp admin</a>.</p>
    </div>);
}
