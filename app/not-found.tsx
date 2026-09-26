import Link from 'next/link';
export default function NotFound() {
  return (<div className="card narrow center" style={{ margin: '0 auto' }}><h1>Halaman tidak ditemukan</h1><p className="muted">Tautan mungkin salah atau pendaftaran bukan milik akun ini.</p><Link className="btn btn-primary" href="/akun">Ke Akun Saya</Link></div>);
}
