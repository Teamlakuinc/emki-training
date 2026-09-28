import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const safe = (s: string) => (s || 'TANPA NAMA').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const dmy = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Silakan masuk', { status: 401 });
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const isCoord = (prof?.role as string) === 'koordinator';
  if (!prof || !(['super_admin', 'admin', 'verifikator'].includes(prof.role) || isCoord) || aal?.currentLevel !== 'aal2')
    return new NextResponse('Akses ditolak', { status: 403 });

  const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
  if (!ids.length) return new NextResponse('Tidak ada peserta dipilih', { status: 400 });

  const { data: apps, error } = await supabase.from('applications')
    .select('id,reg_code,full_name,nik,birth_place,birth_date,gender,address_ktp,city,province,phone,email,education,occupation,workplace,experience_years,extra_answers,status,paid_at,amount,coordinators(name,code),schemes!applications_scheme_id_fkey(name,export_label),exam_sessions(name,start_time,end_time,sort_order,exam_schedules(title,exam_date,tuk,asesor))')
    .in('id', ids);
  if (error) return new NextResponse(error.message, { status: 500 });
  if (isCoord && (apps || []).length !== ids.length) return new NextResponse('Sebagian peserta bukan milik Anda', { status: 403 });
  const rows: any[] = (apps || []).sort((a: any, b: any) =>
    (a.exam_sessions?.exam_schedules?.exam_date || '').localeCompare(b.exam_sessions?.exam_schedules?.exam_date || '') ||
    (a.exam_sessions?.sort_order ?? 0) - (b.exam_sessions?.sort_order ?? 0) || (a.full_name || '').localeCompare(b.full_name || ''));

  // nama folder: "01 - NAMA", nama kembar → tambah no. registrasi
  const nameCount: Record<string, number> = {};
  rows.forEach((r: any) => { const k = safe(r.full_name).toUpperCase(); nameCount[k] = (nameCount[k] || 0) + 1; });
  const pad = String(rows.length).length < 2 ? 2 : String(rows.length).length;
  const folders = rows.map((r: any, i: number) => {
    const n = safe(r.full_name).toUpperCase();
    return `${String(i + 1).padStart(pad, '0')} - ${n}${nameCount[n] > 1 ? ` (${r.reg_code || r.id.slice(0, 8)})` : ''}`;
  });

  const [{ data: reqDocs }, { data: fields }] = await Promise.all([
    supabase.from('required_documents').select('code,name').order('sort_order'),
    supabase.from('custom_fields').select('code,label').order('sort_order'),
  ]);
  const docName = (code: string) => {
    const n = (reqDocs || []).find((d: any) => d.code === code)?.name || code;
    return safe(n.replace(/\(.*?\)/g, '')).slice(0, 50);
  };
  const extraCols = (fields || []).filter((c: any) => rows.some((r: any) => r.extra_answers?.[c.code] != null && r.extra_answers?.[c.code] !== ''));

  // Excel
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data Peserta');
  const headers = ['NO', 'NAMA ASESI', 'NOMOR  INDUK KEPENDUDUKAN (NIK)', 'TEMPAT LAHIR', 'TANGGAL LAHIR (dd/mm/yyyy)', 'JENIS KELAMIN (L/P)',
    'ALAMAT SESUAI KTP', 'KOTA', 'PROVINSI', 'TELP', 'EMAIL', 'PENDIDIKAN ', 'PEKERJAAN', 'PT/INSTITUT', 'TUK', 'SKEMA', 'ASESOR', 'JADWAL UJI',
    'SESI', 'NO REGISTRASI', 'PENGALAMAN (TAHUN)', 'STATUS', 'FOLDER DOKUMEN', 'HARGA DIBAYAR', 'KOORDINATOR', ...extraCols.map((c: any) => c.label.toUpperCase())];
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EAF4' } };
  rows.forEach((r: any, i: number) => {
    const s = r.exam_sessions, j = s?.exam_schedules;
    ws.addRow([i + 1, r.full_name, r.nik, r.birth_place, dmy(r.birth_date), r.gender === 'L' ? 'L (LAKI - LAKI)' : r.gender === 'P' ? 'P (PEREMPUAN)' : '',
      r.address_ktp, r.city, r.province, r.phone, r.email, r.education, r.occupation, r.workplace, j?.tuk || '',
      r.schemes?.export_label || (r.schemes?.name || '').toUpperCase(), j?.asesor || '', dmy(j?.exam_date),
      s ? `${s.name} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})` : '', r.reg_code || '', r.experience_years ?? '',
      r.status === 'paid' ? 'LUNAS' : r.status, folders[i], r.amount != null ? Number(r.amount) : '', r.coordinators ? `${r.coordinators.name} (${r.coordinators.code})` : '', ...extraCols.map((c: any) => r.extra_answers?.[c.code] ?? '')]);
  });
  ws.getColumn(3).numFmt = '@';
  rows.forEach((_: any, i: number) => { ws.getCell(i + 2, 3).value = String(rows[i].nik || ''); });
  ws.columns.forEach((c, idx) => { c.width = [5, 28, 22, 16, 14, 16, 40, 16, 18, 16, 26, 14, 20, 26, 26, 22, 18, 14, 22, 18, 12, 10, 34][idx] || 16; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const zip = new JSZip();
  zip.file('Data Peserta.xlsx', new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer));

  // dokumen per peserta
  const { data: docs } = await supabase.from('application_documents').select('application_id,doc_type,storage_path').in('application_id', ids).eq('is_current', true);
  for (let i = 0; i < rows.length; i++) {
    const r: any = rows[i]; const dir = zip.folder(folders[i])!;
    for (const d of (docs || []).filter((x: any) => x.application_id === r.id)) {
      const { data: file } = await supabase.storage.from('application-documents').download(d.storage_path);
      if (!file) continue;
      const ext = d.storage_path.split('.').pop();
      dir.file(`${docName(d.doc_type)} - ${safe(r.full_name).toUpperCase()}.${ext}`, new Uint8Array(await file.arrayBuffer()));
    }
  }
  const buf = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const j0 = rows[0]?.exam_sessions?.exam_schedules;
  const allSame = rows.every((r: any) => r.exam_sessions?.exam_schedules?.exam_date === j0?.exam_date && r.exam_sessions?.exam_schedules?.tuk === j0?.tuk);
  const fname = rows.length === 1 ? `Peserta_${safe(rows[0].full_name).replace(/ /g, '_')}.zip`
    : allSame && j0 ? `Ujikom_${safe(j0.tuk).replace(/ /g, '-')}_${j0.exam_date}.zip` : `Data_Peserta_${new Date().toISOString().slice(0, 10)}.zip`;
  return new NextResponse(buf as unknown as BodyInit, { headers: {
    'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${fname}"`, 'Cache-Control': 'no-store',
  } });
}
