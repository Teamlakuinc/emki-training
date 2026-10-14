'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import NotifBell from '@/components/admin/NotifBell';

type L = { href: string; label: string; icon: string; badge?: number };

const I: Record<string, JSX.Element> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  check: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6.5 15h4" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.7.7 2.7 2.4 3 5.2" /></>,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  group: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h10M7 17h6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  tag: <path d="M3 12V4h8l10 10-8 8zM7.5 8.5h.01" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  form: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  team: <><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M2.5 19c.5-3 2.8-4.5 5.5-4.5s5 1.5 5.5 4.5M10.5 19c.5-3 2.8-4.5 5.5-4.5s5 1.5 5.5 4.5" /></>,
  out: <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />,
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></>,
};
const Icon = ({ n }: { n: string }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n] || I.more}</svg>;

export default function AdminShell({ children, name, role, main, more, bell }: {
  children: React.ReactNode; name: string; role: string; main: L[]; more: L[];
  bell: { items: any[]; unread: number; lastSeen: string | null };
}) {
  const path = usePathname(); const sp = useSearchParams();
  const [sheet, setSheet] = useState(false);
  useEffect(() => { setSheet(false); }, [path, sp]);
  const isOn = (href: string) => {
    const [p, q] = href.split('?');
    if (q) return path === p && sp.toString().includes(q);
    if (p === '/admin') return path === '/admin';
    if (p === '/admin/pendaftar') return path.startsWith(p) && sp.get('status') !== 'submitted';
    return path.startsWith(p);
  };
  const all = [...main, ...more];
  const current = all.find(l => isOn(l.href))?.label || 'Panel Admin';
  const moreOn = more.some(l => isOn(l.href));
  const badge = (n?: number) => (n ? <span className="nav-badge">{n > 99 ? '99+' : n}</span> : null);

  return (
    <div className="adm-shell">
      <aside className="adm-side" aria-label="Menu admin">
        <div className="adm-side-who"><b>{name}</b><span>{role.replace('_', ' ')}</span></div>
        {[main, more].map((grp, gi) => <div key={gi} className="adm-side-grp">
          {grp.map(l => <Link key={l.href} href={l.href} className={isOn(l.href) ? 'on' : ''}><Icon n={l.icon} /><span>{l.label}</span>{badge(l.badge)}</Link>)}
        </div>)}
        <div className="adm-side-grp">
          <Link href="/akun"><Icon n="web" /><span>Halaman peserta</span></Link>
          <a href="/keluar"><Icon n="out" /><span>Keluar</span></a>
        </div>
      </aside>

      <div className="adm-main">
        <div className="adm-topbar">
          <div className="adm-title"><span className="adm-kicker">Panel Admin</span><b>{current}</b></div>
          <NotifBell items={bell.items} unread={bell.unread} lastSeen={bell.lastSeen} />
        </div>
        {children}
      </div>

      <nav className="adm-tabs" aria-label="Menu utama">
        {main.map(l => <Link key={l.href} href={l.href} className={isOn(l.href) ? 'on' : ''}>
          <span className="ic"><Icon n={l.icon} />{l.badge ? <span className="dot">{l.badge > 99 ? '99+' : l.badge}</span> : null}</span><span>{l.label}</span></Link>)}
        <button type="button" className={sheet || moreOn ? 'on' : ''} onClick={() => setSheet(!sheet)} aria-expanded={sheet}>
          <span className="ic"><Icon n="more" /></span><span>Lainnya</span></button>
      </nav>

      {sheet && <>
        <div className="adm-scrim" onClick={() => setSheet(false)} />
        <div className="adm-sheet" role="dialog" aria-label="Menu lainnya">
          <div className="adm-sheet-head"><span><b>{name}</b><br /><span className="muted small">{role.replace('_', ' ')}</span></span>
            <button type="button" onClick={() => setSheet(false)} aria-label="Tutup">✕</button></div>
          <div className="adm-sheet-grid">
            {more.map(l => <Link key={l.href} href={l.href} className={isOn(l.href) ? 'on' : ''}><span className="ic"><Icon n={l.icon} />{l.badge ? <span className="dot">{l.badge}</span> : null}</span><span>{l.label}</span></Link>)}
            <Link href="/akun"><span className="ic"><Icon n="web" /></span><span>Halaman peserta</span></Link>
            <a href="/keluar"><span className="ic"><Icon n="out" /></span><span>Keluar</span></a>
          </div>
        </div>
      </>}
    </div>
  );
}
