'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { recordStaffDocument } from '@/app/admin/actions';
import { ACCEPT } from '@/lib/format';

/** Upload dokumen yang diisi tim (mis. screenshot Sisfo BNSP). */
export default function StaffDocUpload({ appId, ownerId, docs, current, urls }: { appId: string; ownerId: string; docs: any[]; current: any[]; urls: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  async function up(d: any, file?: File) {
    setErr(''); if (!file) return;
    const acc = ACCEPT[d.accept] || ACCEPT.image_pdf;
    if (!acc.mimes.includes(file.type)) return setErr(`Format harus ${acc.label}.`);
    if (file.size > 10 * 1024 * 1024) return setErr('Maksimal 10 MB.');
    setBusy(d.code);
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${ownerId}/${appId}/tim-${d.code}-${Date.now()}.${ext}`;
    const { error } = await createClient().storage.from('application-documents').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setBusy(''); return setErr('Upload gagal: ' + error.message); }
    const r = await recordStaffDocument(appId, { type: d.code, path, name: file.name, mime: file.type, size: file.size });
    setBusy(''); if (!r.ok) return setErr(r.error!); router.refresh();
  }
  return (<>
    {err && <div className="alert alert-err">{err}</div>}
    {docs.map(d => { const cur = current.find((x: any) => x.doc_type === d.code); return (
      <div className="doc-link" key={d.code} style={{ borderColor: cur ? '#BFE3CD' : 'var(--line)' }}>
        <span><b>{d.name}</b> {cur ? <span className="badge green">✓ Ada</span> : <span className="badge amber">Belum</span>}<div className="muted small">{cur ? `${cur.file_name} · v${cur.version}` : d.description}</div></span>
        <span className="row" style={{ gap: 6 }}>
          {urls[d.code] && <a className="btn btn-outline btn-sm" href={urls[d.code]} target="_blank" rel="noopener">Buka</a>}
          <label className="btn btn-primary btn-sm">{busy === d.code ? 'Mengunggah…' : cur ? 'Ganti' : 'Upload'}
            <input type="file" hidden accept={(ACCEPT[d.accept] || ACCEPT.image_pdf).accept} disabled={!!busy} onChange={e => { up(d, e.target.files?.[0]); e.target.value = ''; }} /></label>
        </span>
      </div>); })}
  </>);
}
