'use client';
import { useEffect, useMemo, useState } from 'react';
import ApplicantTable, { SortSelect } from '@/components/admin/ApplicantTable';

const hasDoc = (r: any, t: string) => (r.application_documents || []).some((d: any) => d.doc_type === t && d.is_current);

/** Pilihan status. Grup kedua = rincian peserta Lunas setelah Ujikom (boleh tumpang tindih dengan tab "Lunas"). */
const TABS: { key: string; label: string; test: (r: any) => boolean; group?: number }[] = [
  { key: 'semua', label: 'Semua', test: r => r.status !== 'draft' },
  { key: 'submitted', label: 'Menunggu verifikasi', test: r => r.status === 'submitted' },
  { key: 'revision_required', label: 'Perlu perbaikan', test: r => r.status === 'revision_required' },
  { key: 'recommended', label: 'Rekomendasi skema', test: r => r.status === 'recommended' },
  { key: 'awaiting_payment', label: 'Menunggu pembayaran', test: r => r.status === 'awaiting_payment' },
  { key: 'payment_review', label: 'Konfirmasi pembayaran', test: r => r.status === 'payment_review' },
  { key: 'paid', label: 'Lunas', test: r => r.status === 'paid' },
  { key: 'belum_ujikom', label: 'Belum ada hasil Ujikom', test: r => r.status === 'paid' && !r.exam_result, group: 2 },
  { key: 'kompeten', label: 'Kompeten', test: r => r.status === 'paid' && r.exam_result === 'kompeten', group: 2 },
  { key: 'kompeten_tanpa_sertifikat', label: 'Sertifikat belum diupload', test: r => r.status === 'paid' && r.exam_result === 'kompeten' && !hasDoc(r, 'sertifikat_bnsp'), group: 2 },
  { key: 'belum_kompeten', label: 'Belum Kompeten', test: r => r.status === 'paid' && r.exam_result === 'belum_kompeten', group: 2 },
  { key: 'expired', label: 'Lewat batas bayar', test: r => r.status === 'expired', group: 3 },
  { key: 'rejected', label: 'Ditolak', test: r => r.status === 'rejected', group: 3 },
  { key: 'cancelled', label: 'Dibatalkan', test: r => r.status === 'cancelled', group: 3 },
  { key: 'draft', label: 'Draft', test: r => r.status === 'draft', group: 3 },
];

const norm = (s: any) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const digits = (s: any) => { const d = String(s ?? '').replace(/\D/g, ''); return d.startsWith('62') ? '0' + d.slice(2) : d; };
function haystack(r: any) {
  const s = r.exam_sessions; const j = s?.exam_schedules;
  return norm([r.full_name, r.reg_code, r.nik, r.email, r.phone, digits(r.phone), r.schemes?.name, r.coordinators?.code,
    j?.tuk, j?.title, s?.name, j?.exam_date].join(' | '));
}

export default function ApplicantBrowser({ rows, templates, site, canResult, schemes, coords, initial }: {
  rows: any[]; templates: any[]; site: string; canResult: boolean; schemes: any[]; coords: any[];
  initial: { status?: string; q?: string; skema?: string; koordinator?: string; urut?: string };
}) {
  const [tab, setTab] = useState(TABS.some(t => t.key === initial.status) ? initial.status! : 'semua');
  const [q, setQ] = useState(initial.q || '');
  const [skema, setSkema] = useState(initial.skema || '');
  const [koor, setKoor] = useState(initial.koordinator || '');
  const [sort, setSort] = useState(initial.urut && initial.urut.includes(':') ? initial.urut : 'daftar:desc');

  // Simpan pilihan di URL (tanpa reload) supaya bisa dibagikan / tetap saat kembali dari detail peserta.
  useEffect(() => {
    const p = new URLSearchParams();
    if (tab !== 'semua') p.set('status', tab); if (q) p.set('q', q); if (skema) p.set('skema', skema);
    if (koor) p.set('koordinator', koor); if (sort !== 'daftar:desc') p.set('urut', sort);
    const qs = p.toString(); window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [tab, q, skema, koor, sort]);

  const indexed = useMemo(() => rows.map(r => ({ r, h: haystack(r) })), [rows]);
  // Filter skema + koordinator + cari dulu, lalu hitung jumlah per tab dari hasil itu.
  const base = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return indexed.filter(({ r, h }) =>
      (!skema || r.scheme_id === skema) &&
      (!koor || (koor === 'tanpa' ? !r.coordinator_id : r.coordinator_id === koor)) &&
      words.every(w => h.includes(w) || (/^\d{4,}$/.test(w) && h.includes(digits(w))))).map(x => x.r);
  }, [indexed, q, skema, koor]);
  const counts = useMemo(() => Object.fromEntries(TABS.map(t => [t.key, base.filter(t.test).length])), [base]);
  const cur = TABS.find(t => t.key === tab) || TABS[0];
  const shown = useMemo(() => base.filter(cur.test), [base, cur]);
  const filtered = !!(q || skema || koor);

  return (
    <>
      <h1>{tab === 'submitted' ? 'Antrean verifikasi' : 'Pendaftar'}</h1>
      <div className="toolbar">
        <div className="field st-search"><label htmlFor="q">Cari</label>
          <input id="q" type="search" value={q} onChange={e => setQ(e.target.value)} aria-label="Cari pendaftar"
            placeholder="Nama / NIK / No. reg / No. WA / email" />
          {q && <button type="button" aria-label="Hapus pencarian" onClick={() => setQ('')}>✕</button>}
        </div>
        <div className="field"><label htmlFor="st">Status</label><select id="st" value={tab} onChange={e => setTab(e.target.value)}>
          {TABS.filter(t => !t.group || t.group === 3).filter(t => t.key !== 'draft').map(t => <option key={t.key} value={t.key}>{t.key === 'semua' ? 'Semua (kecuali draft)' : t.label} ({counts[t.key]})</option>)}
          <optgroup label="Setelah Ujikom">{TABS.filter(t => t.group === 2).map(t => <option key={t.key} value={t.key}>{t.key === 'belum_ujikom' ? 'Lunas · belum ada hasil Ujikom' : t.key === 'kompeten' ? 'Selesai · Kompeten' : t.key === 'belum_kompeten' ? 'Selesai · Belum Kompeten' : 'Kompeten · sertifikat belum diupload'} ({counts[t.key]})</option>)}</optgroup>
          <option value="draft">Draft ({counts.draft})</option></select></div>
        <div className="field"><label htmlFor="sk">Skema</label><select id="sk" value={skema} onChange={e => setSkema(e.target.value)}>
          <option value="">Semua skema</option>{schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field"><label htmlFor="kd">Koordinator</label><select id="kd" value={koor} onChange={e => setKoor(e.target.value)}>
          <option value="">Semua</option><option value="tanpa">Tanpa koordinator</option>{coords.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></div>
        <div className="field"><label>Urutkan</label><SortSelect value={sort} onChange={setSort} /></div>
        {filtered && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setQ(''); setSkema(''); setKoor(''); }}>Reset filter</button>}
      </div>
      <p className="muted small" style={{ margin: '-4px 0 10px' }}>
        Menampilkan <b>{shown.length}</b> pendaftar{tab !== 'semua' ? ` berstatus “${cur.label}”` : ''}{filtered ? ' sesuai filter' : ''}. Klik judul kolom untuk mengurutkan.
      </p>

      <ApplicantTable rows={shown} templates={templates} site={site} canResult={canResult} sort={sort} onSort={setSort} />
    </>
  );
}
