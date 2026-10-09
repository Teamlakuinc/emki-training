'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminFlagSiapkerja, adminClearSiapkerja } from '@/app/admin/actions';
import { fillTemplate, varsFor, waNumber } from '@/lib/templates';
import { waktu } from '@/lib/format';

const QUICK = ['Password salah', 'Email tidak terdaftar di SIAPkerja', 'No. telepon tidak cocok', 'Akun belum diverifikasi / belum aktif'];
const FALLBACK = 'Halo {nama} 🙏\n\nKami dari EMKI tidak bisa masuk ke akun SIAPkerja Anda.\nKendala: {catatan_siapkerja}\n\nMohon perbaiki data akun SIAPkerja Anda di link berikut:\n{link_siapkerja}\n\nTerima kasih 🙏';

/** Tombol "Akun SIAPkerja salah": tandai + WA + email, peserta dapat link perbaikan. */
export default function SiapkerjaFlag({ a, site, template }: { a: any; site: string; template?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(a.siapkerja_fix_note || '');
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [pending, start] = useTransition();

  const sendWa = (n: string) => {
    const v = varsFor({ ...a, siapkerja_fix_note: n }, site);
    let text = fillTemplate(template || FALLBACK, v);
    if (v.email_akun) text += `\n\n(Masuk dengan email: ${v.email_akun})`;
    return `https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(text)}`;
  };

  const submit = () => {
    const n = note.trim();
    if (!n) return setMsg({ t: 'err', m: 'Pilih atau tulis kendalanya dulu.' });
    const w = a.phone ? window.open('', '_blank') : null;   // dibuka dulu supaya tidak diblokir browser
    start(async () => {
      const r = await adminFlagSiapkerja(a.id, n);
      if (!r.ok) { w?.close(); return setMsg({ t: 'err', m: r.error! }); }
      if (w) w.location.href = sendWa(n);
      setMsg({ t: 'ok', m: `Ditandai. Link perbaikan dikirim via WA${r.data?.emailed ? ' dan email' : ''}.` });
      setOpen(false); router.refresh();
    });
  };

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      {msg && <div className={`alert alert-${msg.t}`}>{msg.m}</div>}
      {a.siapkerja_fix_requested_at ? (
        <div className="alert alert-warn small">
          ⚠️ <b>Menunggu peserta memperbaiki akun SIAPkerja</b> (diminta {waktu(a.siapkerja_fix_requested_at)})<br />Kendala: {a.siapkerja_fix_note}
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <a className="btn btn-wa btn-sm" href={a.phone ? sendWa(a.siapkerja_fix_note || '') : undefined} target="_blank" rel="noopener">💬 Kirim ulang pengingat</a>
            <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => start(async () => {
              if (!confirm('Tandai akun SIAPkerja sudah beres (batalkan permintaan perbaikan)?')) return;
              const r = await adminClearSiapkerja(a.id); if (!r.ok) return setMsg({ t: 'err', m: r.error! }); router.refresh();
            })}>✓ Sudah beres</button>
          </div>
        </div>
      ) : (<>
        {a.siapkerja_fixed_at && <div className="alert alert-ok small">✅ Peserta memperbarui akun SIAPkerja pada {waktu(a.siapkerja_fixed_at)}. Silakan coba login lagi.</div>}
        {!open ? (
          <button className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>⚠️ Akun SIAPkerja salah / tidak bisa diakses</button>
        ) : (
          <div>
            <label className="small"><b>Apa kendalanya?</b></label>
            <div className="pill-row" style={{ margin: '6px 0' }}>
              {QUICK.map(q => <button key={q} type="button" className={`btn btn-sm ${note === q ? 'btn-primary' : 'btn-outline'}`} onClick={() => setNote(q)}>{q}</button>)}
            </div>
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="atau tulis sendiri, mis. akun terkunci"
              style={{ width: '100%', font: 'inherit', padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8 }} />
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <button className="btn btn-wa btn-sm" disabled={pending} onClick={submit}>{pending ? 'Memproses…' : '💬 Tandai & kirim link perbaikan'}</button>
              <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => setOpen(false)}>Batal</button>
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>Peserta dapat link untuk mengisi ulang email, no. telepon, dan password SIAPkerja (via WA + email otomatis).</p>
          </div>)}
      </>)}
    </div>
  );
}
