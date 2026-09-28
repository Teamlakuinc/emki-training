import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Silakan masuk', { status: 401 });
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!prof || !['super_admin', 'admin'].includes(prof.role) || aal?.currentLevel !== 'aal2') return new NextResponse('Akses ditolak', { status: 403 });
  const { data: c } = await supabase.from('coordinators').select('code,name').eq('id', params.id).single();
  const { data: apps } = await supabase.from('applications')
    .select('reg_code,full_name,phone,status,amount,base_amount,markup_amount,commission_amount,markup_paid_at,paid_at,schemes!applications_scheme_id_fkey(name),exam_sessions(name,exam_schedules(exam_date,tuk))')
    .eq('coordinator_id', params.id).neq('status', 'draft').order('paid_at', { ascending: true, nullsFirst: false });
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Laporan');
  ws.addRow([`Laporan koordinator: ${c?.name} (${c?.code})`]); ws.getRow(1).font = { bold: true, size: 13 };
  ws.addRow([`Dibuat: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`]); ws.addRow([]);
  ws.addRow(['NO', 'NO REGISTRASI', 'NAMA', 'TELP', 'SKEMA', 'JADWAL', 'TUK', 'STATUS', 'TGL LUNAS', 'HARGA DASAR', 'MARKUP', 'DIBAYAR PESERTA', 'KOMISI', 'KOMISI DIBAYARKAN KE KOORDINATOR']);
  ws.getRow(4).font = { bold: true }; ws.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4EAF4' } };
  let total = 0, unpaid = 0;
  (apps || []).forEach((a: any, i: number) => {
    const j = a.exam_sessions?.exam_schedules;
    if (a.status === 'paid') { total += Number(a.commission_amount || 0); if (!a.markup_paid_at) unpaid += Number(a.commission_amount || 0); }
    ws.addRow([i + 1, a.reg_code, a.full_name, a.phone, a.schemes?.name, j?.exam_date || '', j?.tuk || '', a.status === 'paid' ? 'LUNAS' : a.status,
      a.paid_at ? new Date(a.paid_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }) : '', Number(a.base_amount || 0), Number(a.markup_amount || 0), Number(a.amount || 0), Number(a.commission_amount || 0),
      a.status !== 'paid' ? '-' : a.markup_paid_at ? new Date(a.markup_paid_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'BELUM']);
  });
  ws.addRow([]);
  ws.addRow(['', '', '', '', '', '', '', '', '', 'TOTAL KOMISI (PESERTA LUNAS)', total]).font = { bold: true };
  ws.addRow(['', '', '', '', '', '', '', '', '', 'SUDAH DIBAYARKAN', total - unpaid]).font = { bold: true };
  ws.addRow(['', '', '', '', '', '', '', '', '', 'HARUS DIBAYARKAN', unpaid]).font = { bold: true, color: { argb: 'FFC62828' } };
  [10, 11, 12, 13].forEach(col => { ws.getColumn(col).numFmt = '"Rp" #,##0'; });
  ws.columns.forEach((col, i) => { col.width = [5, 18, 28, 16, 18, 12, 24, 12, 12, 28, 14, 16, 18][i] || 14; });
  const buf = new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer);
  return new NextResponse(buf as unknown as BodyInit, { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="Laporan_Koordinator_${c?.code}_${new Date().toISOString().slice(0, 10)}.xlsx"`, 'Cache-Control': 'no-store' } });
}
