import Link from 'next/link';
import { requireStaff } from '@/lib/admin';
import { NOTIF_KIND, notifHref, ago } from '@/lib/notif';
import { waktu } from '@/lib/format';
import MarkSeen from './MarkSeen';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: { jenis?: string } }) {
  const { supabase, user } = await requireStaff();
  const jenis = searchParams.jenis && NOTIF_KIND[searchParams.jenis] ? searchParams.jenis : '';
  let q = supabase.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(300);
  if (jenis) q = q.eq('kind', jenis);
  const [{ data: items, error }, { data: seen }] = await Promise.all([q, supabase.from('admin_notification_seen').select('last_seen_at').eq('user_id', user.id).maybeSingle()]);
  const last = seen?.last_seen_at ? new Date(seen.last_seen_at) : null;
  return (<>
    <MarkSeen />
    <h1>🔔 Notifikasi</h1>
    <p className="muted">Semua kejadian dari peserta & pembayaran: pendaftaran baru, perbaikan dikirim ulang, bukti transfer, lunas, kedaluwarsa, upload ulang dokumen, perbaikan SIAPkerja, akun baru. Disimpan 90 hari.</p>
    {error && <div className="alert alert-err">Notifikasi belum aktif: jalankan SQL 18 di Supabase EMKI Training.</div>}
    <div className="pill-row" style={{ marginBottom: 14 }}>
      <Link className={`btn btn-sm ${!jenis ? 'btn-primary' : 'btn-outline'}`} href="/admin/notifikasi">Semua</Link>
      {Object.entries(NOTIF_KIND).map(([k, v]) => <Link key={k} className={`btn btn-sm ${jenis === k ? 'btn-primary' : 'btn-outline'}`} href={`/admin/notifikasi?jenis=${k}`}>{v.icon} {v.label}</Link>)}
    </div>
    <div className="card" style={{ padding: 0 }}>
      {!(items || []).length && <p className="muted" style={{ padding: 16, margin: 0 }}>Belum ada notifikasi.</p>}
      {(items || []).map((n: any) => (
        <Link key={n.id} href={notifHref(n)} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'inherit', background: last && new Date(n.created_at) > last ? 'var(--blue-soft)' : undefined }}>
          <span style={{ fontSize: 20 }}>{NOTIF_KIND[n.kind]?.icon || '🔔'}</span>
          <span style={{ flex: 1 }}><b style={{ color: 'var(--ink)' }}>{n.title}</b><div className="small">{n.body}</div></span>
          <span className="muted small" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{ago(n.created_at)}<br />{waktu(n.created_at)}</span>
        </Link>))}
    </div>
  </>);
}
