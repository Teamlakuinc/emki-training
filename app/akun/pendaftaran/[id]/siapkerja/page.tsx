import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cleanId } from '@/lib/applink';
import FixForm from './FixForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Perbaiki akun SIAPkerja' };

export default async function Page({ params }: { params: { id: string } }) {
  const id = cleanId(params.id);
  if (!id) notFound();
  if (id !== params.id) redirect(`/akun/pendaftaran/${id}/siapkerja`);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: a } = await supabase.from('applications')
    .select('id,user_id,full_name,reg_code,siapkerja_email,siapkerja_phone,siapkerja_fix_requested_at,siapkerja_fix_note,siapkerja_fixed_at,schemes!applications_scheme_id_fkey(name)')
    .eq('id', id).maybeSingle();
  // bukan pemilik (salah akun / staf) → halaman utama yang menjelaskan
  if (!a || a.user_id !== user!.id) redirect(`/akun/pendaftaran/${id}`);
  const back = `/akun/pendaftaran/${id}`;

  if (!a.siapkerja_fix_requested_at) return (
    <div className="card narrow center" style={{ margin: '0 auto' }}>
      <h1>{a.siapkerja_fixed_at ? 'Data SIAPkerja sudah diperbarui ✅' : 'Tidak ada perbaikan yang diminta'}</h1>
      <p className="muted">{a.siapkerja_fixed_at ? 'Terima kasih. Tim EMKI akan mencoba login kembali ke akun SIAPkerja Anda.' : 'Saat ini tim EMKI tidak meminta perbaikan data SIAPkerja untuk pendaftaran ini.'}</p>
      <Link className="btn btn-primary" href={back}>Lihat pendaftaran saya</Link>
    </div>
  );

  return (
    <div className="card narrow" style={{ margin: '0 auto' }}>
      <span className="eyebrow">{(a as any).schemes?.name} · {a.reg_code}</span>
      <h1>Perbaiki akun SIAPkerja</h1>
      <div className="alert alert-warn">Tim EMKI tidak bisa masuk ke akun SIAPkerja Anda.<br /><b>Kendala:</b> {a.siapkerja_fix_note || '-'}</div>
      <ol className="small" style={{ paddingLeft: 18, margin: '0 0 16px' }}>
        <li>Buka <a href="https://siapkerja.kemnaker.go.id" target="_blank" rel="noopener">siapkerja.kemnaker.go.id</a> dan pastikan Anda <b>bisa login sendiri</b>.</li>
        <li>Kalau lupa password, pakai fitur <i>Lupa Kata Sandi</i> di SIAPkerja dulu.</li>
        <li>Isi data login yang benar di bawah ini, lalu simpan.</li>
      </ol>
      <FixForm id={a.id} email={a.siapkerja_email || ''} phone={a.siapkerja_phone || ''} back={back} />
    </div>
  );
}
