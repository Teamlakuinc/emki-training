'use client';
/** Kirim event ke Google Tag Manager (dataLayer). Aman dipanggil walau GTM belum termuat. */
export function track(event: string, params: Record<string, any> = {}) {
  if (typeof window === 'undefined') return;
  const w = window as any; w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
}

/** Sekali per browser per kunci (mis. per pendaftaran), supaya konversi tidak terhitung dobel saat halaman dibuka ulang. */
export function trackOnce(key: string, event: string, params: Record<string, any> = {}) {
  try { if (localStorage.getItem(`trk_${key}`)) return; localStorage.setItem(`trk_${key}`, '1'); } catch { /* storage diblokir: tetap kirim */ }
  track(event, params);
}

/** true kalau waktu ISO masih dalam N hari terakhir (supaya peserta lama tidak terhitung sebagai konversi baru). */
export const recent = (iso?: string | null, days = 3) => !!iso && Date.now() - new Date(iso).getTime() < days * 86400000;
