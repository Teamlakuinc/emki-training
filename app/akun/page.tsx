import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { rupiah, STATUS, waktu, statusOf } from '@/lib/format';
import { claimFromCookie } from '@/lib/ref';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Akun Saya' };

export default async function Page({ searchParams }: { searchParams: { error?: string } }) {
  await claimFromCookie();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: apps } = await supabase.from('applications')
    .select('id,reg_code,status,amount,payment_due_at,created_at,exam_result,cert_token,schemes!applications_scheme_id_fkey(name,price)')
    .eq('user_id', user!.id).order('created_at', { ascending: false });
  return (
    <>
      <span className="eyebrow">Akun Saya</span>
      <h1>Pendaftaran sertifikasi</h1>
      <p className="muted">Masuk sebagai {user!.email}</p>
      {searchParams.error && <div className="alert alert-err">Pendaftaran gagal dibuat. Coba lagi atau hubungi admin.</div>}
      {(!apps || apps.length === 0) ? (
        <div className="card center"><p>Belum ada pendaftaran.</p><Link className="btn btn-primary" href="/">Pilih skema sertifikasi</Link></div>
      ) : apps.map((a: any) => {
        const st = statusOf(a);
        return (
          <div className="card app-item" key={a.id}>
            <div>
              <h2 style={{ marginBottom: 4 }}>{a.schemes?.name}</h2>
              <div className="row small"><span className={`badge ${st.tone}`}>{st.label}</span>{a.reg_code && <span className="muted">{a.reg_code}</span>}{a.amount != null && <span className="muted">{rupiah(a.amount)}</span>}</div>
              {a.status === 'awaiting_payment' && a.payment_due_at && <p className="small" style={{ margin: '6px 0 0' }}>Batas bayar: <b>{waktu(a.payment_due_at)}</b></p>}
            </div>
            <div className="row" style={{ gap: 8 }}>
              {a.exam_result === 'kompeten' && a.cert_token && <Link className="btn btn-primary" href={`/sertifikat-bnsp/${a.cert_token}`}>🎓 Sertifikat BNSP</Link>}
              <Link className="btn btn-outline" href={`/akun/pendaftaran/${a.id}`}>{['draft', 'revision_required'].includes(a.status) ? 'Lanjutkan' : 'Lihat detail'}</Link>
            </div>
          </div>
        );
      })}
      <p style={{ marginTop: 20 }}><Link href="/">+ Daftar skema lain</Link></p>
    </>
  );
}
