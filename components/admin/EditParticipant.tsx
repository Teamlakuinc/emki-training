'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PENDIDIKAN, PROVINSI, appliesTo } from '@/lib/format';
import { adminUpdateData } from '@/app/admin/actions';

const inp = { font: 'inherit', fontSize: 14, padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8, width: '100%' } as const;
type F = { k: string; label: string; type?: 'text' | 'date' | 'email' | 'tel' | 'number' | 'textarea'; options?: string[] | [string, string][] };
const GROUPS: { title: string; fields: F[] }[] = [
  { title: 'Identitas', fields: [
    { k: 'full_name', label: 'Nama lengkap (sesuai KTP)' }, { k: 'nik', label: 'NIK (16 digit)' },
    { k: 'birth_place', label: 'Tempat lahir' }, { k: 'birth_date', label: 'Tanggal lahir', type: 'date' },
    { k: 'gender', label: 'Jenis kelamin', options: [['L', 'Laki-laki'], ['P', 'Perempuan']] },
    { k: 'education', label: 'Pendidikan terakhir', options: PENDIDIKAN }] },
  { title: 'Alamat & kontak', fields: [
    { k: 'address_ktp', label: 'Alamat KTP', type: 'textarea' }, { k: 'city', label: 'Kota / Kabupaten' },
    { k: 'province', label: 'Provinsi', options: PROVINSI }, { k: 'phone', label: 'No. WhatsApp', type: 'tel' }, { k: 'email', label: 'Email (di formulir)', type: 'email' }] },
  { title: 'Pekerjaan', fields: [
    { k: 'occupation', label: 'Jabatan / pekerjaan' }, { k: 'workplace', label: 'PT / Institusi' }, { k: 'experience_years', label: 'Lama pengalaman (tahun)', type: 'number' }] },
  { title: 'Akun SIAPkerja', fields: [
    { k: 'siapkerja_email', label: 'Email SIAPkerja', type: 'email' }, { k: 'siapkerja_phone', label: 'No. telepon SIAPkerja', type: 'tel' }] },
];
const KEYS = GROUPS.flatMap(g => g.fields.map(f => f.k));

/** Form edit data peserta untuk admin: semua kolom + pertanyaan tambahan + password SIAPkerja. */
export default function EditParticipant({ a, fields, onMsg }: { a: any; fields: any[]; onMsg: (m: { t: string; m: string }) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const init = () => Object.fromEntries(KEYS.map(k => [k, a[k] == null ? '' : String(a[k])]));
  const [f, setF] = useState<Record<string, string>>(init);
  const custom = (fields || []).filter((c: any) => appliesTo(c, a.scheme_id) || a.extra_answers?.[c.code] != null);
  const [x, setX] = useState<Record<string, string>>(() => Object.fromEntries(custom.map((c: any) => [c.code, a.extra_answers?.[c.code] == null ? '' : String(a.extra_answers[c.code])])));
  const [pw, setPw] = useState('');
  useEffect(() => {
    const go = () => { if (window.location.hash === '#edit-data') { setF(init()); setOpen(true); } };
    go(); window.addEventListener('hashchange', go); return () => window.removeEventListener('hashchange', go);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const field = (d: F) => {
    const v = f[d.k] ?? ''; const on = (e: any) => setF({ ...f, [d.k]: e.target.value });
    const changed = v !== (a[d.k] == null ? '' : String(a[d.k]));
    const style = { ...inp, ...(changed ? { borderColor: '#E0A100', background: '#FFFBEA' } : {}) };
    return (
      <div className="field" key={d.k} style={{ marginBottom: 8, gridColumn: d.type === 'textarea' ? '1 / -1' : undefined }}>
        <label className="small" style={{ fontWeight: 600 }}>{d.label}{changed && <span style={{ color: '#B7791F' }}> · diubah</span>}</label>
        {d.options ? <select value={v} onChange={on} style={style}><option value="">— pilih —</option>
          {(d.options as any[]).map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}</select>
          : d.type === 'textarea' ? <textarea rows={2} value={v} onChange={on} style={style} />
          : <input type={d.type || 'text'} value={v} onChange={on} style={style} inputMode={d.k === 'nik' ? 'numeric' : undefined} />}
      </div>);
  };

  if (!open) return <button className="btn btn-outline btn-sm" onClick={() => { setF(init()); setOpen(true); }}>✎ Edit data peserta</button>;
  return (
    <div>
      {GROUPS.map(g => <div key={g.title} style={{ marginBottom: 6 }}><div className="small" style={{ fontWeight: 700, margin: '8px 0 4px' }}>{g.title}</div>
        <div className="grid2">{g.fields.map(field)}</div></div>)}
      <div className="field" style={{ marginBottom: 8 }}><label className="small" style={{ fontWeight: 600 }}>Password SIAPkerja baru <span className="muted">(kosongkan jika tidak diganti)</span></label>
        <input type="text" autoComplete="off" value={pw} onChange={e => setPw(e.target.value)} style={inp} /></div>
      {custom.length > 0 && <div><div className="small" style={{ fontWeight: 700, margin: '8px 0 4px' }}>Pertanyaan tambahan</div>
        <div className="grid2">{custom.map((c: any) => (
          <div className="field" key={c.code} style={{ marginBottom: 8 }}><label className="small" style={{ fontWeight: 600 }}>{c.label}</label>
            {c.field_type === 'select' && c.options?.length ? <select value={x[c.code] || ''} onChange={e => setX({ ...x, [c.code]: e.target.value })} style={inp}><option value="">— pilih —</option>{c.options.map((o: string) => <option key={o}>{o}</option>)}</select>
              : c.field_type === 'textarea' ? <textarea rows={2} value={x[c.code] || ''} onChange={e => setX({ ...x, [c.code]: e.target.value })} style={inp} />
              : <input type={c.field_type === 'date' ? 'date' : c.field_type === 'number' ? 'number' : 'text'} value={x[c.code] || ''} onChange={e => setX({ ...x, [c.code]: e.target.value })} style={inp} />}
          </div>))}</div></div>}
      <p className="muted small">Kolom yang diubah ditandai kuning. Perubahan tercatat (data lama → baru) di riwayat.</p>
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => start(async () => {
          const r = await adminUpdateData(a.id, f, custom.length ? x : undefined, pw || undefined);
          if (!r.ok) return onMsg({ t: 'err', m: r.error! });
          setPw(''); setOpen(false); history.replaceState(null, '', ' '); onMsg({ t: 'ok', m: 'Data peserta diperbarui.' }); router.refresh();
        })}>{pending ? 'Menyimpan…' : 'Simpan perubahan'}</button>
        <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => { setOpen(false); history.replaceState(null, '', ' '); }}>Batal</button>
      </div>
    </div>
  );
}
