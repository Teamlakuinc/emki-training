import { requireStaff } from '@/lib/admin';
import { DocCard, FieldCard } from '@/components/admin/ConfigForms';

export default async function Page() {
  const { supabase } = await requireStaff('admin');
  const [{ data: docs }, { data: fields }, { data: schemes }] = await Promise.all([
    supabase.from('required_documents').select('*').order('sort_order'),
    supabase.from('custom_fields').select('*').order('sort_order'),
    supabase.from('schemes').select('id,name').order('level_order'),
  ]);
  return (
    <>
      <h1>Formulir pendaftaran</h1>
      <div className="alert alert-info small">Kolom utama (nama, NIK, TTL, alamat, dst. sesuai format Excel LSP) dan data akun SIAPkerja selalu ada dan tidak bisa dihapus. Di sini Anda mengatur <b>dokumen upload</b> dan <b>pertanyaan tambahan</b>. Untuk menyembunyikan tanpa menghapus data lama, hilangkan centang <b>Aktif</b>.</div>
      <h2 style={{ marginTop: 20 }}>Dokumen upload</h2>
      {(docs || []).map(d => <DocCard key={d.code} d={d} schemes={schemes || []} />)}
      <DocCard d={{}} schemes={schemes || []} isNew />
      <h2 style={{ marginTop: 28 }}>Pertanyaan tambahan</h2>
      <p className="muted small">Muncul di langkah "Data diri" dan menjadi kolom tambahan di Excel (setelah kolom format LSP).</p>
      {(fields || []).map(c => <FieldCard key={c.code} c={c} schemes={schemes || []} />)}
      <FieldCard c={{}} schemes={schemes || []} isNew />
    </>
  );
}
