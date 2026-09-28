import Link from 'next/link';
import { requireCoordinator } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Portal Koordinator' };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { coord, name } = await requireCoordinator();
  return (<>
    <nav className="adm-nav" aria-label="Menu koordinator"><Link href="/koordinator">Peserta saya</Link><span className="who">{name} · koordinator {coord.code}</span></nav>
    {children}
  </>);
}
