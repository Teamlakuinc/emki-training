import { requireStaff } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import GroupInvoice from '@/components/admin/GroupInvoice';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireStaff();
  const db = createAdminClient();
  const [{ data: apps }, { data: invs }, { data: items }, { data: pays }] = await Promise.all([
    db.from('applications').select('id,reg_code,full_name,phone,amount,payment_due_at,coordinators(name,code),schemes!applications_scheme_id_fkey(name),exam_sessions(name,exam_schedules(id,title,exam_date))')
      .eq('status', 'awaiting_payment').order('payment_due_at', { ascending: true }).limit(1000),
    db.from('group_invoices').select('id,code,token,title,payer_name,payer_phone,created_at').order('created_at', { ascending: false }).limit(100),
    db.from('group_invoice_items').select('invoice_id,applications(status,amount)'),
    db.from('group_payments').select('invoice_id,status,amount,paid_at'),
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const list = (invs || []).map((g: any) => {
    const its = (items || []).filter((x: any) => x.invoice_id === g.id).map((x: any) => x.applications).filter(Boolean);
    return { ...g, url: `${site}/bayar/kolektif/${g.token}`, count: its.length, paid: its.filter((x: any) => x.status === 'paid').length,
      total: its.reduce((s: number, x: any) => s + Number(x.amount || 0), 0),
      unpaid: its.filter((x: any) => ['awaiting_payment', 'expired', 'payment_review'].includes(x.status)).reduce((s: number, x: any) => s + Number(x.amount || 0), 0),
      lunas: (pays || []).some((p: any) => p.invoice_id === g.id && p.status === 'paid') };
  });
  return (<>
    <h1>Bayar kolektif</h1>
    <p className="muted">Pilih beberapa peserta yang menunggu pembayaran → buat 1 link tagihan. Pembayar (perusahaan/koordinator) cukup buka link dan bayar sekali, tanpa login. Setelah lunas, semua peserta di tagihan otomatis berstatus <b>Lunas</b>.</p>
    <GroupInvoice apps={apps || []} invoices={list} />
  </>);
}
