export const rupiah = (n: number | null | undefined) =>
  n == null ? '-' : 'Rp ' + Number(n).toLocaleString('id-ID');

export const tanggal = (d: string | null | undefined) =>
  !d ? '-' : new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  });

export const waktu = (d: string | null | undefined) =>
  !d ? '-' : new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';

export const jam = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

export const STATUS: Record<string, { label: string; tone: string; desc: string }> = {
  draft:             { label: 'Draft', tone: 'grey', desc: 'Pendaftaran belum dikirim. Lengkapi semua langkah lalu kirim.' },
  submitted:         { label: 'Menunggu verifikasi', tone: 'blue', desc: 'Dokumen Anda sedang diperiksa tim verifikator EMKI. Kami akan mengabari melalui email.' },
  revision_required: { label: 'Perlu perbaikan', tone: 'amber', desc: 'Verifikator meminta perbaikan. Perbarui data/dokumen lalu kirim ulang.' },
  recommended:       { label: 'Rekomendasi skema', tone: 'amber', desc: 'Verifikator merekomendasikan skema lain yang lebih sesuai dengan pengalaman Anda.' },
  awaiting_payment:  { label: 'Menunggu pembayaran', tone: 'green', desc: 'Pendaftaran siap dibayar. Selesaikan pembayaran sebelum batas waktu.' },
  paid:              { label: 'Lunas', tone: 'green', desc: 'Pembayaran diterima. Informasi Ujikom dikirim melalui email dan WhatsApp.' },
  expired:           { label: 'Lewat batas bayar', tone: 'red', desc: 'Batas pembayaran terlewat dan kursi dilepas. Hubungi admin untuk dibuka kembali.' },
  rejected:          { label: 'Ditolak', tone: 'red', desc: 'Pendaftaran tidak dapat dilanjutkan. Lihat catatan verifikator atau hubungi admin.' },
  cancelled:         { label: 'Dibatalkan', tone: 'grey', desc: 'Pendaftaran ini dibatalkan.' },
};

export const PROVINSI = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Kepulauan Bangka Belitung','Bengkulu','Lampung','DKI Jakarta','Jawa Barat','Banten','Jawa Tengah','DI Yogyakarta','Jawa Timur','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Gorontalo','Sulawesi Tengah','Sulawesi Barat','Sulawesi Selatan','Sulawesi Tenggara','Maluku','Maluku Utara','Papua','Papua Barat','Papua Barat Daya','Papua Tengah','Papua Pegunungan','Papua Selatan'];

export const PENDIDIKAN = ['SD','SMP','SMA / SMK / Sederajat','D1','D2','D3','D4 / S1','S2','S3'];

export const DOCS = [
  { type: 'pas_foto', label: 'Pas foto latar belakang merah', hint: 'JPG atau PNG, maksimal 10 MB.', accept: 'image/jpeg,image/png', mimes: ['image/jpeg', 'image/png'] },
  { type: 'qr_siapkerja', label: 'Capture QR Code akun SIAPkerja', hint: 'Screenshot dari aplikasi/situs SIAPkerja. JPG atau PNG.', accept: 'image/jpeg,image/png', mimes: ['image/jpeg', 'image/png'] },
  { type: 'cv_portfolio_paklaring', label: 'CV, portfolio & paklaring (1 PDF)', hint: 'Urutan: CV → portfolio → paklaring, digabung menjadi satu PDF. Maksimal 10 MB.', accept: 'application/pdf', mimes: ['application/pdf'] },
] as const;

export const waLink = (text: string) =>
  `https://wa.me/${process.env.NEXT_PUBLIC_WA_ADMIN || '6285117575842'}?text=${encodeURIComponent(text)}`;
