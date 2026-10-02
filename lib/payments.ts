import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAppEmail } from '@/lib/email';

/** Terapkan notifikasi/status Midtrans (signature sudah diverifikasi / diambil langsung dari API Midtrans). */
export async function applyMidtrans(n: any) {
  const db = createAdminClient();
  const { data: pay } = await db.from('payments').select('application_id,status').eq('order_id', n.order_id).maybeSingle();
  if (!pay) return { ok: false, error: 'order tidak dikenal' };
  const { data: st, error } = await db.rpc('apply_midtrans_notification', {
    p_order_id: n.order_id, p_transaction_status: n.transaction_status, p_fraud_status: n.fraud_status || null,
    p_transaction_id: n.transaction_id || null, p_payment_type: n.payment_type || null,
    p_gross_amount: n.gross_amount != null ? Number(n.gross_amount) : null, p_raw: n,
  });
  if (error) return { ok: false, error: error.message };
  if (st === 'paid' && pay.status !== 'paid') await sendAppEmail(pay.application_id, 'email_lunas');
  return { ok: true, status: st };
}

/** Terapkan notifikasi / hasil cek status dari DOKU */
export async function applyDoku(n: any) {
  const { mapDokuStatus } = await import('@/lib/doku');
  const invoice = n?.order?.invoice_number;
  const st = mapDokuStatus(n?.transaction?.status);
  if (!invoice || !st) return { ok: true, status: null };
  return applyMidtrans({
    order_id: invoice, transaction_status: st, fraud_status: null,
    transaction_id: n?.transaction?.original_request_id || n?.virtual_account_info?.virtual_account_number || null,
    payment_type: n?.channel?.id || n?.service?.id || 'doku',
    gross_amount: n?.order?.amount != null ? Number(n.order.amount) : null, ...n,
  });
}
