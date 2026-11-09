import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Unduh file sertifikat BNSP (link berlaku singkat, dibuat setiap kali diklik). */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  if (!/^[a-z0-9]{10,40}$/.test(params.token)) return new NextResponse('Tidak ditemukan', { status: 404 });
  const db = createAdminClient();
  const { data: a } = await db.from('applications').select('id,full_name,exam_result').eq('cert_token', params.token).maybeSingle();
  if (!a || a.exam_result !== 'kompeten') return new NextResponse('Tidak ditemukan', { status: 404 });
  const { data: doc } = await db.from('application_documents').select('storage_path,mime_type').eq('application_id', a.id).eq('doc_type', 'sertifikat_bnsp').eq('is_current', true).maybeSingle();
  if (!doc) return NextResponse.redirect(new URL(`/sertifikat-bnsp/${params.token}`, req.url));
  const ext = doc.mime_type === 'application/pdf' ? 'pdf' : doc.mime_type === 'image/png' ? 'png' : 'jpg';
  const name = `Sertifikat BNSP - ${(a.full_name || 'peserta').replace(/[\\/:*?"<>|]+/g, ' ').trim()}.${ext}`;
  const { data, error } = await db.storage.from('application-documents').createSignedUrl(doc.storage_path, 120, { download: name });
  if (error || !data) return new NextResponse('Gagal menyiapkan file. Coba lagi.', { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
