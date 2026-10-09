'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { markNotificationsSeen } from '@/app/admin/actions';
import { NOTIF_KIND, notifHref, ago } from '@/lib/notif';

/** Lonceng notifikasi di menu admin. */
export default function NotifBell({ items, unread, lastSeen }: { items: any[]; unread: number; lastSeen: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {   // perbarui otomatis tiap 60 detik saat tab aktif
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 60000);
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => { clearInterval(t); document.removeEventListener('mousedown', close); };
  }, [router]);
  const isNew = (n: any) => !lastSeen || new Date(n.created_at) > new Date(lastSeen);
  const toggle = () => { const o = !open; setOpen(o); if (o && unread) start(async () => { await markNotificationsSeen(); }); };
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={toggle} aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
        style={{ position: 'relative', background: 'none', border: 0, cursor: 'pointer', fontSize: 20, padding: '4px 8px', lineHeight: 1 }}>
        🔔{unread > 0 && <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--red)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '120%', width: 'min(380px, 92vw)', maxHeight: 460, overflowY: 'auto', background: '#fff', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,.14)', zIndex: 50 }}>
          <div className="row between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
            <b style={{ color: 'var(--ink)' }}>Notifikasi</b><Link href="/admin/notifikasi" className="small" onClick={() => setOpen(false)}>Lihat semua</Link></div>
          {!items.length && <p className="muted small" style={{ padding: 14, margin: 0 }}>Belum ada notifikasi.</p>}
          {items.map(n => (
            <Link key={n.id} href={notifHref(n)} onClick={() => setOpen(false)}
              style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'inherit', background: isNew(n) ? 'var(--blue-soft)' : '#fff' }}>
              <span style={{ fontSize: 18 }}>{NOTIF_KIND[n.kind]?.icon || '🔔'}</span>
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>{n.title}</span>
                <span className="muted small" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</span>
                <span className="muted" style={{ fontSize: 12 }}>{ago(n.created_at)}</span></span>
            </Link>))}
        </div>)}
    </div>
  );
}
