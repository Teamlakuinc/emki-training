import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { tanggal } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sertifikat BNSP', robots: { index: false } };

/** Halaman unduh sertifikat BNSP untuk peserta (tanpa login, lewat link dari WA). */
export default async function Page({ params }: { params: { token: string } }) {
  if (!/^[a-z0-9]{10,40}$/.test(params.token)) notFound();
  const db = createAdminClient();
  const { data: a } = await db.from('applications')
    .select('id,full_name,reg_code,exam_result,exam_done_at,schemes!applications_scheme_id_fkey(name),exam_sessions(exam_schedules(exam_date,tuk))')
    .eq('cert_token', params.token).maybeSingle();
  if (!a || a.exam_result !== 'kompeten') notFound();
  const { data: doc } = await db.from('application_documents').select('id,file_name,created_at').eq('application_id', a.id).eq('doc_type', 'sertifikat_bnsp').eq('is_current', true).maybeSingle();
  const j: any = (a as any).exam_sessions?.exam_schedules;
  return (
    <div className="card narrow" style={{ margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 46, lineHeight: 1 }}>🎓</div>
      <span className="eyebrow" style={{ marginTop: 10 }}>Sertifikat BNSP</span>
      <h1 style={{ marginBottom: 6 }}>Selamat, {a.full_name}!</h1>
      <p className="muted" style={{ marginTop: 0 }}>Anda dinyatakan <b style={{ color: 'var(--green-text, #0B7F48)' }}>KOMPETEN</b> pada Uji Kompetensi BNSP</p>
      <dl className="kv" style={{ textAlign: 'left', margin: '18px 0' }}>
        <dt>Skema</dt><dd>{(a as any).schemes?.name}</dd>
        {j?.exam_date && <><dt>Tanggal Ujikom</dt><dd>{tanggal(j.exam_date)}{j.tuk ? ` · ${j.tuk}` : ''}</dd></>}
        <dt>No. registrasi</dt><dd>{a.reg_code}</dd>
      </dl>
      {doc ? <a className="btn btn-primary btn-block" href={`/sertifikat-bnsp/${params.token}/unduh`}>⬇ Unduh sertifikat</a>
        : <div className="alert alert-warn" style={{ textAlign: 'left' }}>Sertifikat BNSP Anda sedang diproses. Kami akan mengirim link ini lagi lewat WhatsApp setelah sertifikat terbit.</div>}
      <p className="muted small" style={{ marginTop: 14 }}>Simpan file sertifikat dengan baik. Link ini bersifat pribadi, jangan dibagikan ke orang lain.</p>
    </div>
  );
}
