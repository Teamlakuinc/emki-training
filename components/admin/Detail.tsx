'use client';
import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS, jam, rupiah, tanggal, waktu, appliesTo } from '@/lib/format';
import { fillTemplate, varsFor, waNumber } from '@/lib/templates';
import { decide, moveSession, extendPayment, revealSecret, saveAdminNotes, logNotification } from '@/app/admin/actions';

const DEC: Record<string, string> = { approve: '✅ Disetujui', revision: '📄 Minta perbaikan', recommend: '🔁 Rekomendasi skema', reject: '⛔ Ditolak' };

export default function Detail(p: any) {
  const { a } = p;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [decision, setDecision] = useState('approve');
  const [note, setNote] = useState('');
  const [rec, setRec] = useState('');
  const [target, setTarget] = useState('');
  const [force, setForce] = useState(false);
  const [reason, setReason] = useState('');
  const [secret, setSecret] = useState('');
  const [notes, setNotes] = useState(a.admin_notes || '');
  const [result, setResult] = useState(a.exam_result || '');
  const st = STATUS[a.status];
  const s = a.exam_sessions, j = s?.exam_schedules;

  const run = (fn: () => Promise<any>, ok: string) => start(async () => {
    setMsg(null); const r = await fn();
    if (!r.ok) return setMsg({ t: 'err', m: r.error });
    setMsg({ t: 'ok', m: ok }); router.refresh();
  });
  const wa = (key: string) => {
    const t = p.templates.find((x: any) => x.key === key); if (!t) return;
    window.open(`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(fillTemplate(t.body, varsFor(a, p.site)))}`, '_blank', 'noopener');
    logNotification(a.id, key);
  };

  return (
    <>
      <div className="row between">
        <div>
          <a href="/admin/pendaftar" className="small">← Daftar pendaftar</a>
          <h1 style={{ margin: '6px 0 4px' }}>{a.full_name || '(nama belum diisi)'}</h1>
          <div className="row small"><span className={`badge ${st.tone}`}>{st.label}</span><span>{a.schemes?.name}</span>{a.orig && <span className="muted">(awal: {a.orig.name})</span>}<span className="muted">{a.reg_code}</span><span className="muted">{rupiah(a.amount ?? a.schemes?.price)}</span></div>
        </div>
        <a className="btn btn-outline btn-sm" href={`/admin/export?ids=${a.id}`}>⬇ Download peserta ini</a>
      </div>
      {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`} style={{ marginTop: 14 }}>{msg.m}</div>}

      <div className="grid2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div>
          {a.status === 'submitted' && (
            <div className="card" style={{ borderColor: 'var(--blue)' }}>
              <h2>Keputusan verifikasi</h2>
              <div className="pill-row" style={{ marginBottom: 12 }}>
                {Object.entries(DEC).map(([k, v]) => <label key={k} className="check" style={{ border: '1.5px solid var(--line)', borderRadius: 8, padding: '6px 10px', background: decision === k ? 'var(--blue-soft)' : '#fff' }}>
                  <input type="radio" name="dec" checked={decision === k} onChange={() => setDecision(k)} />{v}</label>)}
              </div>
              {decision === 'recommend' && <div className="field"><label htmlFor="rec">Rekomendasikan ke skema</label>
                <select id="rec" value={rec} onChange={e => setRec(e.target.value)}><option value="">— pilih —</option>
                  {p.schemes.filter((x: any) => x.id !== a.scheme_id).map((x: any) => <option key={x.id} value={x.id}>{x.name} ({rupiah(x.price)})</option>)}</select></div>}
              <div className="field"><label htmlFor="note">Catatan untuk peserta {decision !== 'approve' && <span className="opt">(wajib)</span>}</label>
                <textarea id="note" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={decision === 'recommend' ? 'mis. Pengalaman di paklaring baru 1 tahun, lebih sesuai skema Demi Chef.' : ''} /></div>
              <button className="btn btn-primary" disabled={pending || (decision === 'recommend' && !rec)}
                onClick={() => run(() => decide(a.id, decision, note, rec), 'Keputusan tersimpan. Kirim kabar ke peserta lewat tombol WhatsApp di bawah.')}>Simpan keputusan</button>
            </div>
          )}

          <div className="card">
            <h2>Data peserta</h2>
            <dl className="kv">
              <dt>Nama</dt><dd>{a.full_name}</dd><dt>NIK</dt><dd>{a.nik}</dd>
              <dt>Tempat, tgl lahir</dt><dd>{a.birth_place}, {a.birth_date ? tanggal(a.birth_date) : '-'}</dd>
              <dt>Jenis kelamin</dt><dd>{a.gender === 'L' ? 'Laki-laki' : a.gender === 'P' ? 'Perempuan' : '-'}</dd>
              <dt>Alamat KTP</dt><dd>{a.address_ktp}</dd><dt>Kota / Provinsi</dt><dd>{a.city} / {a.province}</dd>
              <dt>Telp / WA</dt><dd>{a.phone}</dd><dt>Email</dt><dd>{a.email}</dd>
              <dt>Pendidikan</dt><dd>{a.education}</dd><dt>Pekerjaan</dt><dd>{a.occupation}</dd><dt>PT / Institusi</dt><dd>{a.workplace}</dd>
              <dt>Pengalaman</dt><dd><b>{a.experience_years ?? '-'} tahun</b></dd>
              {p.fields.filter((c: any) => a.extra_answers?.[c.code] != null && a.extra_answers?.[c.code] !== '').map((c: any) => <Fragment key={c.code}><dt>{c.label}</dt><dd>{String(a.extra_answers[c.code])}</dd></Fragment>)}
            </dl>
          </div>

          <div className="card">
            <h2>Akun SIAPkerja</h2>
            <dl className="kv"><dt>Email</dt><dd>{a.siapkerja_email || '-'}</dd><dt>No. telepon</dt><dd>{a.siapkerja_phone || '-'}</dd>
              <dt>Password</dt><dd>{secret ? <span className="secret">{secret}</span> : p.hasSecret ? '•••••••• (tersimpan terenkripsi)' : 'Tidak tersedia / sudah dihapus otomatis'}</dd></dl>
            {p.isAdmin && p.hasSecret && !secret && (
              <div className="row" style={{ marginTop: 12 }}>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan membuka, mis. input ke SIAPkerja LSP" style={{ flex: 1, minWidth: 220, font: 'inherit', padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8 }} />
                <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => start(async () => {
                  const r = await revealSecret(a.id, reason);
                  if (!r.ok) return setMsg({ t: 'err', m: r.error });
                  setSecret(r.data); setTimeout(() => setSecret(''), 60000);
                })}>🔓 Tampilkan password</button>
              </div>)}
            {secret && <p className="muted small">Password disembunyikan lagi otomatis dalam 60 detik. Akses ini tercatat.</p>}
          </div>
        </div>

        <div>
          <div className="card">
            <h2>Dokumen</h2>
            {p.reqDocs.filter((d: any) => appliesTo(d, a.scheme_id) || p.docs.some((x: any) => x.doc_type === d.code)).map((d: any) => { const cur = p.docs.find((x: any) => x.doc_type === d.code); return (
              <div className="doc-link" key={d.code}><span><b>{d.name}</b><div className="muted small">{cur ? `${cur.file_name} · v${cur.version}` : d.is_required ? 'Belum diunggah' : 'Belum diunggah (opsional)'}</div></span>
                {p.urls[d.code] && <a className="btn btn-outline btn-sm" href={p.urls[d.code]} target="_blank" rel="noopener">Buka</a>}</div>); })}
          </div>

          <div className="card">
            <h2>Jadwal</h2>
            {j ? <dl className="kv"><dt>Tanggal</dt><dd>{tanggal(j.exam_date)}</dd><dt>Sesi</dt><dd>{s.name} ({jam(s.start_time)}–{jam(s.end_time)})</dd><dt>TUK</dt><dd>{j.tuk}</dd>
              {a.payment_due_at && <><dt>Batas bayar</dt><dd>{waktu(a.payment_due_at)}</dd></>}{a.paid_at && <><dt>Lunas</dt><dd>{waktu(a.paid_at)}</dd></>}</dl> : <p className="muted">Belum memilih jadwal.</p>}
            {p.isAdmin && (<>
              <div className="field" style={{ marginTop: 14 }}><label htmlFor="mv">Pindahkan ke sesi</label>
                <select id="mv" value={target} onChange={e => setTarget(e.target.value)}><option value="">— pilih sesi —</option>
                  {p.sessions.filter((x: any) => x.id !== a.session_id).map((x: any) => <option key={x.id} value={x.id}>{tanggal(x.exam_schedules.exam_date)} · {x.name} {jam(x.start_time)} · {x.exam_schedules.tuk}</option>)}</select></div>
              <label className="check small"><input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />Paksa walaupun sesi tujuan penuh</label>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn btn-outline btn-sm" disabled={!target || pending} onClick={() => run(() => moveSession(a.id, target, force), 'Sesi dipindahkan. Kirim info ke peserta lewat WhatsApp.')}>Pindahkan</button>
                {['awaiting_payment', 'expired'].includes(a.status) && <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => extendPayment(a.id, 72), 'Batas bayar diperpanjang 3×24 jam.')}>Perpanjang batas bayar 3×24 jam</button>}
              </div>
            </>)}
          </div>

          <div className="card">
            <h2>Kirim WhatsApp</h2>
            <div className="pill-row">{p.templates.map((t: any) => <button key={t.key} className="btn btn-wa btn-sm" disabled={!a.phone} onClick={() => wa(t.key)}>💬 {t.title}</button>)}</div>
            {p.notifs.length > 0 && <p className="muted small" style={{ marginTop: 10 }}>Terakhir: {p.notifs.slice(0, 3).map((n: any) => `${n.template_key} (${waktu(n.created_at)})`).join(' · ')}</p>}
          </div>

          {p.isAdmin && <div className="card">
            <h2>Catatan internal & hasil Ujikom</h2>
            <div className="field"><label htmlFor="res">Hasil Ujikom</label><select id="res" value={result} onChange={e => setResult(e.target.value)}><option value="">Belum ada</option><option value="kompeten">Kompeten</option><option value="belum_kompeten">Belum kompeten</option></select></div>
            <div className="field"><label htmlFor="an">Catatan admin (tidak terlihat peserta)</label><textarea id="an" rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => saveAdminNotes(a.id, notes, result), 'Tersimpan.')}>Simpan</button>
          </div>}

          {p.logs.length > 0 && <div className="card"><h2>Riwayat verifikasi</h2>
            {p.logs.map((l: any, i: number) => <p key={i} className="small" style={{ margin: '0 0 8px' }}><b>{DEC[l.decision]}</b> · {waktu(l.created_at)} · {l.profiles?.full_name || l.profiles?.email}<br />{l.note}</p>)}</div>}
        </div>
      </div>
    </>
  );
}
