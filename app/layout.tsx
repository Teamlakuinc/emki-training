import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { createClient } from '@/lib/supabase/server';


export const metadata: Metadata = {
  title: { default: 'Pendaftaran Sertifikasi — EMKI', template: '%s — EMKI Sertifikasi' },
  description: 'Pendaftaran Sertifikasi Kompetensi BNSP Juru Masak bersama EMKI dan LSP Rajawali.',
  icons: { icon: '/favicon.png' },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let staff = false;
  if (user) { const { data: pr } = await supabase.from('profiles').select('role').eq('id', user.id).single(); staff = !!pr && ['super_admin', 'admin', 'verifikator'].includes(pr.role); }
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=IBM+Plex+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="hdr">
          <div className="wrap">
            <a className="brand" href="https://edukasikuliner.com/"><img src="/logo-emki.png" alt="EMKI" /><span>Pendaftaran Sertifikasi</span></a>
            <nav>
              <a href="https://edukasikuliner.com/sertifikasi/">Skema</a>
              {user ? (<>{staff && <Link href="/admin">Panel Admin</Link>}<Link href="/akun">Akun Saya</Link><a href="/keluar">Keluar</a></>) : (<><Link href="/masuk">Masuk</Link><Link href="/daftar-akun" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 14 }}>Buat Akun</Link></>)}
            </nav>
          </div>
        </header>
        <main><div className="wrap">{children}</div></main>
        <footer className="ftr"><div className="wrap">
          <span>© EMKI — Yayasan Edukasi Mandiri Kuliner Indonesia</span>
          <span><a href="https://edukasikuliner.com/kontak/">Bantuan</a> · <a href="https://lakuinc.com/" target="_blank" rel="noopener">Powered by : Laku.Inc</a></span>
        </div></footer>
      </body>
    </html>
  );
}
