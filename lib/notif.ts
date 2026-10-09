export const NOTIF_KIND: Record<string, { label: string; icon: string }> = {
  verifikasi: { label: 'Verifikasi', icon: '📝' },
  pembayaran: { label: 'Pembayaran', icon: '💳' },
  dokumen: { label: 'Dokumen', icon: '📎' },
  siapkerja: { label: 'SIAPkerja', icon: '🔐' },
  akun: { label: 'Akun baru', icon: '👤' },
  batal: { label: 'Batal', icon: '⛔' },
};
export const notifHref = (n: any) => n.application_id ? `/admin/pendaftar/${n.application_id}` : n.kind === 'akun' ? '/admin/akun' : '/admin/notifikasi';
export function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'baru saja'; if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`; return `${Math.floor(s / 86400)} hari lalu`;
}
