import { requireStaff, paymentMethod } from '@/lib/admin';
import PaymentSettings from '@/components/admin/PaymentSettings';

export default async function Page() {
  const { supabase } = await requireStaff('super');
  const { data: banks } = await supabase.from('bank_accounts').select('*').order('sort_order');
  return (<><h1>Pengaturan pembayaran</h1>
    <PaymentSettings method={await paymentMethod()} banks={banks || []} midtransReady={!!process.env.MIDTRANS_SERVER_KEY && !!process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} /></>);
}
