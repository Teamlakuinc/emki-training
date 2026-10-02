'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveCoordinator } from '@/app/admin/actions';

const inp = { style: { font: 'inherit', fontSize: 14, padding: '7px 9px', border: '1.5px solid #D5D8DC', borderRadius: 8, width: '100%' } } as const;

export default function CoordinatorForm({ c, schemes, markups = [] }: { c?: any; schemes: any[]; markups?: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const def = markups.find(m => !m.scheme_id);
  const per = (sid: string) => markups.find(m => m.scheme_id === sid);
  return (
    <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => {
      const r = await saveCoordinator(f); if (!r.ok) return setMsg({ t: 'err', m: r.error! });
      setMsg({ t: 'ok', m: 'Tersimpan.' }); if (!c) router.push(`/admin/koordinator/${r.data}`); else router.refresh(); }); }}>
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`}>{msg.m}</div>}
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid2">
        <div className="field"><label>Nama koordinator</label><input name="name" defaultValue={c?.name} required {...inp} /></div>
        <div className="field"><label>Kode link (huruf besar/angka)</label><input name="code" defaultValue={c?.code} required placeholder="mis. BUDI" style={{ ...inp.style, textTransform: 'uppercase' }} />
          <div className="hint">Link: training.edukasikuliner.com/r/KODE</div></div>
      </div>
      <div className="grid2">
        <div className="field"><label>No. WhatsApp</label><input name="phone" defaultValue={c?.phone || ''} {...inp} /></div>
        <div className="field"><label>Catatan internal</label><input name="notes" defaultValue={c?.notes || ''} {...inp} /></div>
      </div>
      <div className="field"><span className="lbl">Markup</span>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Berlaku untuk</th><th>Jenis</th><th>Nilai</th></tr></thead><tbody>
          <tr><td><b>Semua skema</b> (default)</td>
            <td><select name="m_default_type" defaultValue={def?.markup_type || 'amount'} {...inp}><option value="amount">Rupiah (+Rp)</option><option value="percent">Persen (+%)</option></select></td>
            <td><input name="m_default_value" inputMode="decimal" defaultValue={def ? Number(def.value) : ''} placeholder="mis. 250000 atau 10" {...inp} /></td></tr>
          {schemes.map(s => { const m = per(s.id); return (
            <tr key={s.id}><td>{s.name} <span className="muted small">(opsional, menimpa default)</span></td>
              <td><select name={`m_type_${s.id}`} defaultValue={m?.markup_type || 'amount'} {...inp}><option value="amount">Rupiah (+Rp)</option><option value="percent">Persen (+%)</option></select></td>
              <td><input name={`m_value_${s.id}`} inputMode="decimal" defaultValue={m ? Number(m.value) : ''} placeholder="— pakai default —" {...inp} /></td></tr>); })}
        </tbody></table></div>
        <div className="hint">Markup dihitung dari harga jadwal (termasuk harga khusus lokasi). Persen dibulatkan ke rupiah terdekat.</div>
      </div>
      <div className="field"><label>Komisi tetap per peserta lunas (jika skema tidak punya markup)</label>
        <input name="flat_commission" inputMode="numeric" defaultValue={c?.flat_commission ?? 100000} {...inp} />
        <div className="hint">Kalau peserta terkena markup, komisi = markup. Kalau tidak ada markup, komisi = angka ini (dibayar EMKI).</div></div>
      {c && <label className="check small" style={{ marginBottom: 10 }}><input type="checkbox" name="apply_unpaid" defaultChecked />Terapkan perubahan markup ke peserta koordinator ini yang <b>belum membayar</b></label>}
      <div className="row between">
        <label className="check small"><input type="checkbox" name="is_active" defaultChecked={c?.is_active ?? true} />Aktif (link bisa dipakai)</label>
        <button className="btn btn-primary" disabled={pending}>{c ? 'Simpan' : 'Buat koordinator'}</button>
      </div>
    </form>
  );
}
