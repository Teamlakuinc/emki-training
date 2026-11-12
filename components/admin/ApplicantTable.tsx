'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { statusOf, rupiah, tanggal, jam } from '@/lib/format';
import { fillTemplate, varsFor, waNumber } from '@/lib/templates';
import { logNotification, setExamResult } from '@/app/admin/actions';

type Props = { rows: any[]; templates: any[]; site: string; showSchedule?: boolean; canResult?: boolean;
  sort?: string; onSort?: (s: string) => void };

const STATUS_ORDER = ['draft', 'submitted', 'revision_required', 'recommended', 'awaiting_payment', 'payment_review', 'paid', 'expired', 'rejected', 'cancelled'];
const hasDoc = (r: any, t: string) => (r.application_documents || []).some((d: any) => d.doc_type === t && d.is_current);
const statusRank = (r: any) => STATUS_ORDER.indexOf(r.status) * 10 + (r.status === 'paid' ? (r.exam_result === 'kompeten' ? 2 : r.exam_result === 'belum_kompeten' ? 1 : 0) : 0);

/** Nilai pembanding per kunci urutan. null = selalu di bawah. */
export const SORTS: Record<string, { label: string; get: (r: any) => string | number | null }> = {
  daftar:     { label: 'Tanggal daftar', get: r => r.submitted_at || r.created_at || null },
  nama:       { label: 'Nama', get: r => (r.full_name || '').trim().toLowerCase() || null },
  skema:      { label: 'Skema', get: r => r.schemes?.name?.toLowerCase() || null },
  status:     { label: 'Status', get: r => statusRank(r) },
  jadwal:     { label: 'Jadwal Ujikom', get: r => { const s = r.exam_sessions; const d = s?.exam_schedules?.exam_date; return d ? `${d} ${s.start_time || ''}` : null; } },
  koordinator:{ label: 'Koordinator', get: r => r.coordinators?.code?.toLowerCase() || null },
  pengalaman: { label: 'Pengalaman', get: r => r.experience_years ?? null },
  harga:      { label: 'Harga', get: r => r.amount ?? null },
  bayar:      { label: 'Tanggal lunas', get: r => r.paid_at || null },
  batas:      { label: 'Batas bayar', get: r => r.payment_due_at || null },
  ujikom:     { label: 'Tanggal hasil Ujikom', get: r => r.exam_done_at || null },
  sisfo:      { label: 'Sisfo', get: r => (hasDoc(r, 'screenshot_sisfo') ? 1 : 0) },
  sertifikat: { label: 'Sertifikat BNSP', get: r => (r.exam_result === 'kompeten' ? (hasDoc(r, 'sertifikat_bnsp') ? 2 : 1) : null) },
  reg:        { label: 'No. Reg', get: r => r.reg_code || null },
};

export function sortRows(rows: any[], sort: string) {
  const [key, dir] = sort.split(':'); const def = SORTS[key]; if (!def) return rows;
  const m = dir === 'asc' ? 1 : -1;
  return rows.map((r, i) => ({ r, i, v: def.get(r) })).sort((a, b) => {
    if (a.v == null && b.v == null) return a.i - b.i;
    if (a.v == null) return 1; if (b.v == null) return -1;
    const c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v), 'id', { numeric: true });
    return c ? c * m : a.i - b.i;
  }).map(x => x.r);
}

export default function ApplicantTable({ rows: rawRows, templates, site, showSchedule = true, canResult = true, sort: sortProp, onSort }: Props) {
  const router = useRouter(); const [pending, start] = useTransition(); const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sortLocal, setSortLocal] = useState('daftar:desc');
  const sort = sortProp ?? sortLocal; const setSort = onSort ?? setSortLocal;
  const rows = useMemo(() => sortRows(rawRows, sort), [rawRows, sort]);
  // Centangan yang tidak lagi terlihat (pindah tab / hasil cari) dilepas, supaya tidak ikut ter-download/ditandai.
  useEffect(() => { setSel(s => { const vis = new Set(rawRows.map(r => r.id)); const n = new Set(Array.from(s).filter(id => vis.has(id))); return n.size === s.size ? s : n; }); }, [rawRows]);
  const [sKey, sDir] = sort.split(':');
  const th = (key: string, label: string) => (
    <th aria-sort={sKey === key ? (sDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => setSort(`${key}:${sKey === key && sDir === 'asc' ? 'desc' : sKey === key ? 'asc' : (['nama', 'skema', 'koordinator', 'reg', 'jadwal', 'status'].includes(key) ? 'asc' : 'desc')}`)}>
        {label}<span className={sKey === key ? 'on' : ''}>{sKey === key ? (sDir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
  const paidIds = useMemo(() => rows.filter(r => r.status === 'paid').map(r => r.id), [rows]);
  const waitingIds = useMemo(() => rows.filter(r => r.status === 'paid' && !r.exam_result).map(r => r.id), [rows]);
  const selPaid = Array.from(sel).filter(id => paidIds.includes(id));
  const mark = (result: 'kompeten' | 'belum_kompeten' | null) => {
    if (!selPaid.length) return;
    const label = result === 'kompeten' ? 'KOMPETEN' : result === 'belum_kompeten' ? 'BELUM KOMPETEN' : 'belum Ujikom (hasil dihapus)';
    if (!confirm(`Tandai ${selPaid.length} peserta sebagai ${label}?`)) return;
    start(async () => { setMsg(null); const r = await setExamResult(selPaid, result); if (!r.ok) return setMsg({ t: 'err', m: r.error || 'Gagal.' });
      setMsg({ t: 'ok', m: `${r.data.done} peserta ditandai ${label}.${r.data.skipped ? ` ${r.data.skipped} dilewati karena belum Lunas.` : ''}` }); setSel(new Set()); router.refresh(); });
  };
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allChecked = rows.length > 0 && rows.every(r => sel.has(r.id));
  const download = (ids: string[]) => { if (ids.length) window.location.href = `/admin/export?ids=${ids.join(',')}`; };

  function sendWa(r: any, key: string) {
    const t = templates.find(x => x.key === key);
    if (!t) return;
    const text = fillTemplate(t.body, varsFor(r, site));
    window.open(`https://wa.me/${waNumber(r.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    logNotification(r.id, key);
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => setSel(new Set(paidIds))} disabled={!paidIds.length}>Pilih semua yang lunas ({paidIds.length})</button>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => setSel(new Set())} disabled={!sel.size}>Kosongkan</button>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => download(Array.from(sel))} disabled={!sel.size}>⬇ Download yang dicentang ({sel.size})</button>
        <span className="muted small">Excel + 1 folder dokumen per peserta.</span>
        {!onSort && <label className="small" style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>Urutkan
          <SortSelect value={sort} onChange={setSort} /></label>}
      </div>
      {canResult && <div className="row" style={{ marginBottom: 10, padding: '10px 12px', background: 'var(--blue-soft, #EEF3FB)', borderRadius: 10, gap: 8 }}>
        <b className="small">Hasil Ujikom:</b>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => setSel(new Set(waitingIds))} disabled={!waitingIds.length}>Pilih yang belum ada hasil ({waitingIds.length})</button>
        <button className="btn btn-primary btn-sm" type="button" disabled={pending || !selPaid.length} onClick={() => mark('kompeten')}>✅ Tandai Kompeten ({selPaid.length})</button>
        <button className="btn btn-outline btn-sm" type="button" disabled={pending || !selPaid.length} onClick={() => mark('belum_kompeten')}>Belum Kompeten ({selPaid.length})</button>
        <button className="btn btn-outline btn-sm" type="button" disabled={pending || !selPaid.length} onClick={() => mark(null)} title="Hapus hasil (kembali ke Lunas)">↺ Batalkan hasil</button>
      </div>}
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr>
          <th><input type="checkbox" aria-label="Pilih semua" checked={allChecked} onChange={() => setSel(allChecked ? new Set() : new Set(rows.map(r => r.id)))} /></th>
          {th('nama', 'Nama')}{th('skema', 'Skema')}{th('status', 'Status')}{showSchedule && th('jadwal', 'Jadwal & sesi')}{th('koordinator', 'Koordinator')}{th('pengalaman', 'Pengalaman')}{th('sisfo', 'Sisfo')}{th('sertifikat', 'Sert. BNSP')}{th('reg', 'No. Reg')}<th>Kirim WA</th>
        </tr></thead>
        <tbody>
          {rows.map(r => {
            const st = statusOf(r); const s = r.exam_sessions; const j = s?.exam_schedules;
            return (
              <tr key={r.id}>
                <td><input type="checkbox" aria-label={`Pilih ${r.full_name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td><Link href={`/admin/pendaftar/${r.id}`}>{r.full_name || '(belum diisi)'}</Link><div className="muted small">{r.phone}</div></td>
                <td>{r.schemes?.name}<div className="muted small">{r.amount != null ? rupiah(r.amount) : 'harga belum dikunci'}</div></td>
                <td><span className={`badge ${st.tone}`}>{st.label}</span></td>
                {showSchedule && <td className="small">{j ? <>{tanggal(j.exam_date)}<div className="muted">{s.name} {jam(s.start_time)}–{jam(s.end_time)} · {j.tuk}</div></> : '-'}</td>}
                <td className="small">{r.coordinators?.code || <span className="muted">—</span>}</td>
                <td>{r.experience_years != null ? `${r.experience_years} th` : '-'}</td>
                <td>{(r.application_documents || []).some((d: any) => d.doc_type === 'screenshot_sisfo' && d.is_current) ? <span className="badge green">✓</span> : <span className="badge grey">belum</span>}</td>
                <td>{r.exam_result === 'kompeten' ? ((r.application_documents || []).some((d: any) => d.doc_type === 'sertifikat_bnsp' && d.is_current) ? <span className="badge green">✓ ada</span> : <span className="badge amber">belum upload</span>) : <span className="muted small">—</span>}</td>
                <td className="small">{r.reg_code || '-'}</td>
                <td>
                  <select aria-label="Pilih template WA" defaultValue="" disabled={!r.phone}
                    onChange={e => { if (e.target.value) sendWa(r, e.target.value); e.target.value = ''; }}
                    style={{ font: 'inherit', fontSize: 13, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #1FAF57' }}>
                    <option value="">💬 Pilih pesan…</option>
                    {templates.map(t => <option key={t.key} value={t.key}>{t.title}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={11} className="muted">Tidak ada data.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}

/** Dropdown urutan: kunci + arah (terbaru/terlama, A–Z/Z–A). */
export function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [key, dir] = value.split(':');
  const text = ['nama', 'skema', 'koordinator', 'reg'].includes(key);
  const st = { font: 'inherit', fontSize: 14, padding: '8px 10px', borderRadius: 8, border: '1px solid #CFD1D4', background: '#fff' } as const;
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <select aria-label="Urutkan berdasarkan" value={key} onChange={e => onChange(`${e.target.value}:${dir}`)} style={st}>
        {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <select aria-label="Arah urutan" value={dir} onChange={e => onChange(`${key}:${e.target.value}`)} style={st}>
        <option value="desc">{text ? 'Z → A' : key === 'status' ? 'Tahap akhir dulu' : key === 'pengalaman' || key === 'harga' || key === 'sisfo' || key === 'sertifikat' ? 'Terbesar dulu' : 'Terbaru dulu'}</option>
        <option value="asc">{text ? 'A → Z' : key === 'status' ? 'Tahap awal dulu' : key === 'pengalaman' || key === 'harga' || key === 'sisfo' || key === 'sertifikat' ? 'Terkecil dulu' : 'Terlama dulu'}</option>
      </select>
    </span>
  );
}
