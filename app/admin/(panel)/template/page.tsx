import { requireStaff } from '@/lib/admin';
import TemplateEditor from '@/components/admin/TemplateEditor';

export default async function Page() {
  const { supabase } = await requireStaff('admin');
  const { data } = await supabase.from('message_templates').select('*').eq('channel', 'whatsapp').order('sort_order');
  return (
    <>
      <h1>Template pesan WhatsApp</h1>
      <div className="alert alert-info small">Variabel yang bisa dipakai (otomatis diganti data peserta): <code>{'{nama} {skema} {reg_code} {tanggal} {sesi} {jam} {tuk} {alamat} {link} {batas_bayar} {nominal} {catatan} {skema_rekomendasi}'}</code></div>
      <TemplateEditor list={data || []} />
    </>
  );
}
