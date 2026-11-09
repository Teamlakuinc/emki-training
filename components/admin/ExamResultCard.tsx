'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logNotification, setExamResult } from '@/app/admin/actions';
import { fillTemplate, varsFor, waNumber } from '@/lib/templates';
import { waktu } from '@/lib/format';
import StaffDocUpload from '@/components/admin/StaffDocUpload';

/** Hasil Ujikom (Kompeten / Belum Kompeten) + upload sertifikat BNSP + kirim link unduh via WA. */
export default function ExamResultCard({ a, site, isAdmin, templates, certDoc, current, urls }: {
  a: any; site: string; isAdmin: boolean; templates: any[]; certDoc?: any; current: any[]; urls: Record<string, string>;
}) {
  const router = useRouter(); const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const cert = current.find((x: any) => x.doc_type === 'sertifikat_bnsp');
  const link = a.cert_token ? `${site}/sertifikat-bnsp/${a.cert_token}` : '';
  const set = (r: 'kompeten' | 'belum_kompeten' | null, label: string) => start(async () => {
    setMsg(null); const res = await setExamResult([a.id], r);
    if (!res.ok) return setMsg({ t: 'err', m: res.error || 'Gagal.' });
    setMsg({ t: 'ok', m: label }); router.refresh();
  });
  const sendWa = () => {
    const t = templates.find((x: any) => x.key === 'wa_sertifikat_bnsp');
    const text = t ? fillTemplate(t.body, varsFor(a, site))
      : `Halo ${a.full_name}, selamat! Anda dinyatakan KOMPETEN pada Uji Kompetensi BNSP skema ${a.schemes?.name || ''}.\n\nSertifikat BNSP Anda bisa diunduh di:\n${link}\n\nTim EMKI`;
    window.open(`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    logNotification(a.id, 'wa_sertifikat_bnsp');
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setMsg({ t: 'ok', m: 'Link disalin.' }); } catch { setMsg({ t: 'err', m: 'Gagal menyalin, salin manual.' }); } };

  return (
    <div className="card" style={{ borderColor: a.exam_result === 'kompeten' ? '#BFE3CD' : 'var(--blue)' }}>
      <h2>Hasil Ujikom &amp; sertifikat BNSP</h2>
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}

      {!a.exam_result && (<>
        <p className="muted small">Peserta sudah Lunas. Setelah Ujikom selesai, tandai hasilnya di sini (atau massal dari daftar Pendaftar).</p>
        {isAdmin && <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => { if (confirm(`Tandai ${a.full_name} KOMPETEN?`)) set('kompeten', 'Ditandai Kompeten. Upload sertifikat BNSP-nya di bawah.'); }}>✅ Kompeten</button>
          <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => { if (confirm(`Tandai ${a.full_name} BELUM KOMPETEN?`)) set('belum_kompeten', 'Ditandai Belum Kompeten.'); }}>Belum Kompeten</button>
        </div>}
      </>)}

      {a.exam_result && (<>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <span className={`badge ${a.exam_result === 'kompeten' ? 'green' : 'amber'}`}>{a.exam_result === 'kompeten' ? 'Selesai · Kompeten' : 'Selesai · Belum Kompeten'}</span>
          {a.exam_done_at && <span className="muted small">ditandai {waktu(a.exam_done_at)}</span>}
          {isAdmin && <button className="btn btn-outline btn-sm" style={{ padding: '2px 10px' }} disabled={pending}
            onClick={() => { if (confirm('Batalkan hasil Ujikom? Status kembali ke Lunas.')) set(null, 'Hasil dibatalkan, status kembali Lunas.'); }}>↺ Batalkan</button>}
        </div>

        {a.exam_result === 'kompeten' && (<>
          {isAdmin && certDoc ? <StaffDocUpload appId={a.id} ownerId={a.user_id} docs={[certDoc]} current={current} urls={urls} />
            : <p className="small">{cert ? '✓ Sertifikat BNSP sudah diupload.' : 'Sertifikat BNSP belum diupload.'}</p>}

          <div style={{ marginTop: 12 }}>
            <label className="lbl" style={{ fontSize: 13 }}>Link unduh untuk peserta (tanpa login)</label>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, wordBreak: 'break-all', background: 'var(--panel)', padding: '8px 10px', borderRadius: 8 }}>{link}</div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <button className="btn btn-wa btn-sm" disabled={!cert || !a.phone} onClick={sendWa} title={!cert ? 'Upload sertifikat dulu' : ''}>💬 Kirim link sertifikat via WA</button>
              <button className="btn btn-outline btn-sm" onClick={copy}>📋 Salin link</button>
              <a className="btn btn-outline btn-sm" href={link} target="_blank" rel="noopener">Lihat halaman peserta</a>
            </div>
            {!cert && <p className="muted small" style={{ marginTop: 6 }}>Tombol WA aktif setelah sertifikat diupload.</p>}
          </div>
        </>)}

        {a.exam_result === 'belum_kompeten' && <p className="muted small">Peserta belum kompeten. Sertifikat BNSP tidak diterbitkan. Catat rencana uji ulang di catatan internal.</p>}
      </>)}
    </div>
  );
}
