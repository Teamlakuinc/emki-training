import { requireStaff } from '@/lib/admin';
import { SchemeCard } from '@/components/admin/ConfigForms';

export default async function Page() {
  const { supabase } = await requireStaff('admin');
  const { data } = await supabase.from('schemes').select('*').order('level_order');
  return (
    <>
      <h1>Skema & harga</h1>
      <div className="alert alert-info small">Harga <b>dikunci saat peserta mengirim pendaftaran</b>. Perubahan harga hanya berlaku untuk pendaftar berikutnya. Harga di halaman WordPress ikut berubah otomatis.</div>
      {(data || []).map(s => <SchemeCard key={s.id} s={s} />)}
      <SchemeCard s={{}} isNew />
      <p className="muted small">Skema baru langsung bisa didaftar di training.edukasikuliner.com/daftar/slug. Untuk halaman penjelasannya di WordPress, kabari tim web.</p>
    </>
  );
}
