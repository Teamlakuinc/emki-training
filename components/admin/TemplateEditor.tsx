'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveTemplate } from '@/app/admin/actions';

function One({ t, isNew }: { t: any; isNew?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  return (
    <form className="card" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
      start(async () => { const r = await saveTemplate(f); if (!r.ok) return setMsg({ t: 'err', m: r.error! }); setMsg({ t: 'ok', m: 'Tersimpan.' }); if (isNew) form.reset(); router.refresh(); }); }}>
      {isNew && <h2>Tambah template baru</h2>}
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
      <div className="grid2">
        <div className="field"><label>Judul (tampil di tombol)</label><input name="title" defaultValue={t.title} required /></div>
        <div className="field"><label>Kode {isNew ? '' : '(tidak bisa diubah)'}</label><input name="key" defaultValue={t.key} readOnly={!isNew} required placeholder="mis. wa_info_hasil" /></div>
      </div>
      <input type="hidden" name="channel" value={t.channel || 'whatsapp'} />
      {t.channel === 'email' && <div className="field"><label>Subjek email</label><input name="subject" defaultValue={t.subject || ''} /></div>}
      <div className="field"><label>Isi pesan</label><textarea name="body" rows={7} defaultValue={t.body} required /></div>
      <div className="row between">
        <label className="check small"><input type="checkbox" name="is_active" defaultChecked={t.is_active !== false} />Aktif (muncul sebagai tombol)</label>
        <span className="row"><input type="number" name="sort_order" defaultValue={t.sort_order ?? 50} title="Urutan" style={{ width: 70, font: 'inherit', padding: '7px 8px', border: '1.5px solid #D5D8DC', borderRadius: 8 }} />
          <button className="btn btn-primary btn-sm" disabled={pending}>Simpan</button></span>
      </div>
    </form>
  );
}
export default function TemplateEditor({ list }: { list: any[] }) {
  return <>{list.map(t => <One key={t.key} t={t} />)}<One t={{ key: '', title: '', body: '', channel: 'whatsapp' }} isNew /></>;
}
