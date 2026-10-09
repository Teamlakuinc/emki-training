import { jam, rupiah, tanggal, waktu } from '@/lib/format';

export function fillTemplate(body: string, vars: Record<string, string | null | undefined>) {
  return body.replace(/\{([a-z_]+)\}/g, (m, k) => (vars[k] ?? '').toString() || m);
}

/** Nomor HP Indonesia → format wa.me (62...) */
export function waNumber(phone?: string | null) {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}

export function varsFor(a: any, site: string) {
  const s = a.exam_sessions, j = s?.exam_schedules;
  return {
    nama: a.full_name, skema: a.schemes?.name, reg_code: a.reg_code || '(belum ada)',
    tanggal: j ? tanggal(j.exam_date) : '', sesi: s?.name || '', jam: s ? `${jam(s.start_time)}–${jam(s.end_time)} WIB` : '',
    tuk: j?.tuk || '', alamat: j?.address || '', link: `${site}/akun/pendaftaran/${a.id}`, email_akun: a.account_email || a.email || '',
    link_siapkerja: `${site}/akun/pendaftaran/${a.id}/siapkerja`, catatan_siapkerja: a.siapkerja_fix_note || 'data login tidak cocok / akun tidak bisa diakses',
    batas_bayar: a.payment_due_at ? waktu(a.payment_due_at) : '', catatan: a.verifier_note || '',
    skema_rekomendasi: a.rec?.name || '', nominal: rupiah(a.amount),
  };
}
