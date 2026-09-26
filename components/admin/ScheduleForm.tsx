'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSchedule } from '@/app/admin/actions';

export default function ScheduleForm({ j, schemes, selected, prices = {} }: { j?: any; schemes: any[]; selected: string[]; prices?: Record<string, number> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  return (
    <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => {
      const r = await saveSchedule(f);
      if (!r.ok) return setMsg({ t: 'err', m: r.error! });
      setMsg({ t: 'ok', m: 'Jadwal tersimpan.' });
      if (!j) router.push(`/admin/jadwal/${r.data}`); else router.refresh();
    }); }}>
      {j && <input type="hidden" name="id" value={j.id} />}
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
      <div className="field"><label htmlFor="t">Judul jadwal</label><input id="t" name="title" required defaultValue={j?.title} placeholder="mis. Ujikom Semarang — Oktober 2026" /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="d">Tanggal Ujikom</label><input id="d" type="date" name="exam_date" required defaultValue={j?.exam_date} /></div>
        <div className="field"><label htmlFor="dl">Batas pendaftaran <span className="opt">(opsional)</span></label><input id="dl" type="date" name="registration_deadline" defaultValue={j?.registration_deadline || ''} /></div>
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="tuk">TUK (Tempat Uji Kompetensi)</label><input id="tuk" name="tuk" required defaultValue={j?.tuk} placeholder="mis. HOTEL CANDI INDAH SEMARANG" /></div>
        <div className="field"><label htmlFor="as">Asesor <span className="opt">(opsional, ikut di Excel)</span></label><input id="as" name="asesor" defaultValue={j?.asesor || ''} /></div>
      </div>
      <div className="field"><label htmlFor="ad">Alamat lengkap</label><input id="ad" name="address" defaultValue={j?.address || ''} /></div>
      <div className="field"><span className="lbl">Skema yang diuji di jadwal ini</span>
        <div className="chk-grid">{schemes.map(s => <label key={s.id}><input type="checkbox" name="schemes" value={s.id} defaultChecked={!j || selected.includes(s.id)} />{s.name}</label>)}</div></div>
      <div className="field"><span className="lbl">Harga di jadwal ini <span className="opt">(kosongkan = harga dasar skema; isi jika lokasi ini berbeda harga, mis. ada biaya transport)</span></span>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Skema</th><th>Harga dasar</th><th>Harga khusus jadwal ini</th></tr></thead><tbody>
          {schemes.map(s => <tr key={s.id}><td>{s.name}</td><td>Rp {Number(s.price).toLocaleString('id-ID')}</td>
            <td><input name={`price_${s.id}`} inputMode="numeric" defaultValue={prices[s.id] ?? ''} placeholder="— sama dengan dasar —" style={{ font: 'inherit', fontSize: 14, padding: '6px 8px', border: '1.5px solid #D5D8DC', borderRadius: 8, width: 180 }} /></td></tr>)}
        </tbody></table></div></div>
      <div className="grid2">
        <div className="field"><label htmlFor="st">Status</label><select id="st" name="status" defaultValue={j?.status || 'draft'}>
          <option value="draft">Draft (belum tampil ke peserta)</option><option value="open">Dibuka (peserta bisa memilih)</option>
          <option value="closed">Ditutup (tidak menerima pendaftar baru)</option><option value="done">Selesai</option></select></div>
        <div className="field"><label htmlFor="n">Catatan internal</label><input id="n" name="notes" defaultValue={j?.notes || ''} /></div>
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Menyimpan…' : j ? 'Simpan perubahan' : 'Buat jadwal'}</button>
    </form>
  );
}
