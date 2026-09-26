'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveScheme, saveRequiredDoc, saveCustomField } from '@/app/admin/actions';
import { rupiah } from '@/lib/format';

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const submit = (fn: (f: FormData) => Promise<any>, reset = false) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
    start(async () => { const r = await fn(f); if (!r.ok) return setMsg({ t: 'err', m: r.error }); setMsg({ t: 'ok', m: 'Tersimpan.' }); if (reset) form.reset(); router.refresh(); });
  };
  const Msg = () => msg ? <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div> : null;
  return { pending, submit, Msg };
}
const inp = { style: { font: 'inherit', fontSize: 14, padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8, width: '100%' } } as const;

/* ---------- skema ---------- */
export function SchemeCard({ s, isNew }: { s: any; isNew?: boolean }) {
  const { pending, submit, Msg } = useSave();
  const [price, setPrice] = useState(String(s.price ?? ''));
  return (
    <form className="card" onSubmit={submit(saveScheme, isNew)}>
      {isNew ? <h2>Tambah skema baru</h2> : <h2>{s.name} <span className="muted small">/{s.slug}</span></h2>}
      <Msg />
      {s.id && <input type="hidden" name="id" value={s.id} />}
      <div className="grid2">
        <div className="field"><label>Nama skema</label><input name="name" defaultValue={s.name} required {...inp} /></div>
        <div className="field"><label>Harga (Rp)</label><input name="price" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} required {...inp} />
          <div className="hint">{price ? rupiah(Number(price)) : ''} · berlaku untuk pendaftar yang mengirim setelah disimpan</div></div>
      </div>
      <div className="grid2">
        {isNew && <div className="field"><label>Slug (alamat halaman)</label><input name="slug" placeholder="mis. pastry-chef" required {...inp} /><div className="hint">Dipakai di training.edukasikuliner.com/daftar/slug — tidak bisa diubah.</div></div>}
        <div className="field"><label>Nama di Excel LSP</label><input name="export_label" defaultValue={s.export_label || ''} placeholder="mis. CHEF DE PARTIE (CDP)" {...inp} /></div>
        <div className="field"><label>Urutan tampil</label><input name="level_order" type="number" defaultValue={s.level_order ?? 10} {...inp} /></div>
      </div>
      <div className="row between">
        <div className="row">
          <label className="check small"><input type="checkbox" name="requires_verification" defaultChecked={s.requires_verification ?? true} />Perlu verifikasi sebelum bayar</label>
          <label className="check small"><input type="checkbox" name="is_active" defaultChecked={s.is_active ?? true} />Aktif (bisa didaftar)</label>
        </div>
        <button className="btn btn-primary btn-sm" disabled={pending}>{isNew ? 'Tambah skema' : 'Simpan'}</button>
      </div>
    </form>
  );
}

function SchemePicker({ schemes, selected }: { schemes: any[]; selected?: string[] | null }) {
  return (<div className="field"><span className="lbl">Berlaku untuk skema <span className="opt">(kosongkan semua = semua skema)</span></span>
    <div className="chk-grid">{schemes.map(x => <label key={x.id}><input type="checkbox" name="scheme_ids" value={x.id} defaultChecked={!!selected?.includes(x.id)} />{x.name}</label>)}</div></div>);
}

/* ---------- dokumen ---------- */
export function DocCard({ d, schemes, isNew }: { d: any; schemes: any[]; isNew?: boolean }) {
  const { pending, submit, Msg } = useSave();
  return (
    <form className="card" onSubmit={submit(saveRequiredDoc, isNew)}>
      {isNew && <h2>Tambah dokumen</h2>}
      <Msg />
      <input type="hidden" name="is_new" value={isNew ? '1' : '0'} />
      <div className="grid2">
        <div className="field"><label>Nama dokumen</label><input name="name" defaultValue={d.name} required {...inp} /></div>
        <div className="field"><label>Kode {isNew ? '(huruf kecil & garis bawah)' : '(tetap)'}</label><input name="code" defaultValue={d.code} readOnly={!isNew} required placeholder="mis. sertifikat_pelatihan" {...inp} /></div>
      </div>
      <div className="field"><label>Keterangan untuk peserta</label><input name="description" defaultValue={d.description || ''} {...inp} /></div>
      <div className="grid2">
        <div className="field"><label>Format diterima</label><select name="accept" defaultValue={d.accept || 'image_pdf'} {...inp}>
          <option value="image">Foto saja (JPG/PNG)</option><option value="pdf">PDF saja</option><option value="image_pdf">Foto atau PDF</option></select></div>
        <div className="field"><label>Urutan</label><input name="sort_order" type="number" defaultValue={d.sort_order ?? 10} {...inp} /></div>
      </div>
      <SchemePicker schemes={schemes} selected={d.scheme_ids} />
      <div className="row between">
        <div className="row"><label className="check small"><input type="checkbox" name="is_required" defaultChecked={d.is_required ?? true} />Wajib</label>
          <label className="check small"><input type="checkbox" name="is_active" defaultChecked={d.is_active ?? true} />Aktif (tampil di form)</label></div>
        <button className="btn btn-primary btn-sm" disabled={pending}>{isNew ? 'Tambah dokumen' : 'Simpan'}</button>
      </div>
    </form>
  );
}

/* ---------- pertanyaan tambahan ---------- */
export function FieldCard({ c, schemes, isNew }: { c: any; schemes: any[]; isNew?: boolean }) {
  const { pending, submit, Msg } = useSave();
  const [type, setType] = useState(c.field_type || 'text');
  return (
    <form className="card" onSubmit={submit(saveCustomField, isNew)}>
      {isNew && <h2>Tambah pertanyaan</h2>}
      <Msg />
      <input type="hidden" name="is_new" value={isNew ? '1' : '0'} />
      <div className="grid2">
        <div className="field"><label>Pertanyaan</label><input name="label" defaultValue={c.label} required placeholder="mis. Ukuran baju" {...inp} /></div>
        <div className="field"><label>Kode {isNew ? '(huruf kecil & garis bawah)' : '(tetap)'}</label><input name="code" defaultValue={c.code} readOnly={!isNew} required placeholder="mis. ukuran_baju" {...inp} /></div>
      </div>
      <div className="grid2">
        <div className="field"><label>Tipe jawaban</label><select name="field_type" value={type} onChange={e => setType(e.target.value)} {...inp}>
          <option value="text">Teks singkat</option><option value="textarea">Teks panjang</option><option value="number">Angka</option><option value="date">Tanggal</option><option value="select">Pilihan (dropdown)</option></select></div>
        <div className="field"><label>Urutan</label><input name="sort_order" type="number" defaultValue={c.sort_order ?? 10} {...inp} /></div>
      </div>
      {type === 'select' && <div className="field"><label>Pilihan jawaban (satu per baris)</label><textarea name="options" rows={4} defaultValue={(c.options || []).join('\n')} {...inp} /></div>}
      <div className="field"><label>Petunjuk <span className="opt">(opsional)</span></label><input name="help_text" defaultValue={c.help_text || ''} {...inp} /></div>
      <SchemePicker schemes={schemes} selected={c.scheme_ids} />
      <div className="row between">
        <div className="row"><label className="check small"><input type="checkbox" name="is_required" defaultChecked={c.is_required ?? false} />Wajib</label>
          <label className="check small"><input type="checkbox" name="is_active" defaultChecked={c.is_active ?? true} />Aktif (tampil di form)</label></div>
        <button className="btn btn-primary btn-sm" disabled={pending}>{isNew ? 'Tambah pertanyaan' : 'Simpan'}</button>
      </div>
    </form>
  );
}
