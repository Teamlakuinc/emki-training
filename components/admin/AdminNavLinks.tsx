'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** Menu admin: 1 baris bisa digeser di HP, menu aktif disorot & otomatis terlihat. */
export default function AdminNavLinks({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname(); const sp = useSearchParams();
  const ref = useRef<HTMLElement>(null);
  const isOn = (href: string) => {
    const [p, q] = href.split('?');
    if (q) return path === p && sp.toString().includes(q);
    if (p === '/admin') return path === '/admin';
    if (p === '/admin/pendaftar') return path.startsWith(p) && !sp.get('status');
    return path.startsWith(p);
  };
  useEffect(() => { ref.current?.querySelector('a.on')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [path]);
  return (
    <nav ref={ref} className="adm-nav" aria-label="Menu admin">
      {links.map(l => <Link key={l.href} href={l.href} className={isOn(l.href) ? 'on' : ''}>{l.label}{l.badge ? <span className="nav-badge">{l.badge}</span> : null}</Link>)}
    </nav>
  );
}
