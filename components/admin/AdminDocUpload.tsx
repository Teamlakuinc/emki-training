'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { adminDocUploadUrl, adminRecordDocument, adminBackToVerification, adminRestoreDocument } from '@/app/admin/actions';
import { ACCEPT } from '@/lib/format';

/** Dokumen peserta + tombol upload/ganti oleh admin (versi lama tetap tersimpan). */
export default function AdminDocUpload({ appId, status, docs, current, urls, history = [], histUrls = {} }: { appId: string; status: string; docs: any[]; current: any[]; urls: Record<string, string>; history?: any[]; histUrls?: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [changed, setChanged] = useState(false);
  const [pending, start] = useTransition();

  async function up(d: any, file?: File) {
    setMsg(null); if (!file) return;
    const acc = ACCEPT[d.accept] || ACCEPT.image_pdf;
    if (!acc.mimes.includes(file.type)) return setMsg({ t: 'err', m: `${d.name}: format harus ${acc.label}.` });
    if (file.size > 10 * 1024 * 1024) return setMsg({ t: 'err', m: 'Maksimal 10 MB.' });
    setBusy(d.code);
    try {
      const r1 = await adminDocUploadUrl(appId, d.code, file.type, file.size);
      if (!r1.ok) return setMsg({ t: 'err', m: r1.error! });
      const { error } = await createClient().storage.from('application-documents').uploadToSignedUrl(r1.data.path, r1.data.token, file, { contentType: file.type });
      if (error) return setMsg({ t: 'err', m: 'Upload gagal: ' + error.message });
      const r2 = await adminRecordDocument(appId, { type: d.code, path: r1.data.path, name: file.name, mime: file.type, size: file.size });
      if (!r2.ok) return setMsg({ t: 'err', m: r2.error! });
      setChanged(true); setMsg({ t: 'ok', m: `${d.name} berhasil diperbarui.` }); router.refresh();
    } catch { setMsg({ t: 'err', m: 'Koneksi terputus. Coba lagi.' }); }
    finally { setBusy(''); }
  }

  return (<>
    {msg && <div className={`alert alert-${msg.t}`}>{msg.m}</div>}
    {docs.map(d => { const cur = current.find((x: any) => x.doc_type === d.code); return (
      <div className="doc-link" key={d.code} style={{ flexWrap: 'wrap' }}>
        <span><b>{d.name}</b><div className="muted small">{cur ? `${cur.file_name} · v${cur.version}` : d.is_required ? 'Belum diunggah' : 'Belum diunggah (opsional)'}</div></span>
        <span className="row" style={{ gap: 6 }}>
          {urls[d.code] && <a className="btn btn-outline btn-sm" href={urls[d.code]} target="_blank" rel="noopener">Buka</a>}
          <label className="btn btn-outline btn-sm" title="Upload file perbaikan atas nama peserta">{busy === d.code ? 'Mengunggah…' : cur ? 'Ganti' : 'Upload'}
            <input type="file" hidden accept={(ACCEPT[d.accept] || ACCEPT.image_pdf).accept} disabled={!!busy} onChange={e => { up(d, e.target.files?.[0]); e.target.value = ''; }} /></label>
        </span>
        {history.some((h: any) => h.doc_type === d.code) && (
          <details className="small" style={{ flexBasis: '100%', marginTop: 6 }}>
            <summary>Versi sebelumnya ({history.filter((h: any) => h.doc_type === d.code).length})</summary>
            {history.filter((h: any) => h.doc_type === d.code).map((h: any) => (
              <div key={h.id} className="row between" style={{ gap: 6, padding: '4px 0' }}>
                <span className="muted">v{h.version} · {h.file_name}</span>
                <span className="row" style={{ gap: 6 }}>
                  {histUrls[h.id] && <a className="btn btn-outline btn-sm" href={histUrls[h.id]} target="_blank" rel="noopener">Buka</a>}
                  <button className="btn btn-outline btn-sm" disabled={pending || !!busy} onClick={() => start(async () => {
                    if (!confirm(`Pakai kembali v${h.version} sebagai dokumen aktif?`)) return;
                    const r = await adminRestoreDocument(appId, h.id); if (!r.ok) return setMsg({ t: 'err', m: r.error! });
                    setMsg({ t: 'ok', m: `v${h.version} dipakai kembali.` }); router.refresh();
                  })}>Pakai versi ini</button>
                </span>
              </div>))}
          </details>)}
      </div>); })}
    <p className="muted small" style={{ marginTop: 8 }}>Admin bisa mengganti dokumen atas nama peserta. Versi lama tetap tersimpan dan perubahan tercatat.</p>
    {status === 'revision_required' && (
      <div className={`alert ${changed ? 'alert-info' : 'alert-warn'}`} style={{ marginTop: 8 }}>
        {changed ? 'Dokumen sudah diperbarui. ' : 'Status masih "Perlu perbaikan". '}
        Kalau semua dokumen sudah beres, kembalikan ke antrean supaya bisa langsung diverifikasi.
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={pending || !!busy} onClick={() => start(async () => {
            if (!confirm('Kembalikan pendaftaran ini ke antrean verifikasi?')) return;
            const r = await adminBackToVerification(appId);
            if (!r.ok) return setMsg({ t: 'err', m: r.error! });
            setMsg({ t: 'ok', m: 'Pendaftaran kembali ke antrean verifikasi. Silakan verifikasi.' }); router.refresh();
          })}>{pending ? 'Memproses…' : '↩ Kirim ke antrean verifikasi'}</button>
        </div>
      </div>)}
  </>);
}
