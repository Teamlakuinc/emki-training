import { requireStaff } from '@/lib/admin';
import TemplateEditor from '@/components/admin/TemplateEditor';

export default async function Page() {
  const { supabase } = await requireStaff('admin');
  const { data } = await supabase.from('message_templates').select('*').order('channel', { ascending: false }).order('sort_order');
  return (
    <>
      <h1>Template pesan WhatsApp & email</h1>
      <div className="alert alert-info small">Variabel yang bisa dipakai (otomatis diganti data peserta): <code>{'{nama} {skema} {reg_code} {tanggal} {sesi} {jam} {tuk} {alamat} {link} {batas_bayar} {nominal} {catatan} {skema_rekomendasi}'}</code></div>
      <TemplateEditor list={data || []} />
      <p className="muted small">Template <b>email_…</b> dikirim otomatis oleh sistem: email_terkirim (pendaftaran diterima), email_siap_bayar (Cook dikirim / disetujui verifikator), email_revisi, email_rekomendasi, email_ditolak, email_lunas (pembayaran diterima), email_jadwal (tombol kirim email di halaman jadwal). Hilangkan centang Aktif untuk menghentikan salah satunya.</p>
    </>
  );
}
