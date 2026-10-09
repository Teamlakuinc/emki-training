'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ACCEPT, PENDIDIKAN, PROVINSI, STATUS, jam, rupiah, tanggal, waktu, waLink } from '@/lib/format';
import {
  saveSession, savePersonal, saveSiapkerja, recordDocument, getDocUrl, saveConsent,
  submitApplication, acceptRecommendation, cancelApplication, createPayment, checkPayment, submitProof, applyReferral, createDokuPayment,
} from '@/app/akun/actions';

type Props = { app: any; scheme: any; userId: string; sessions: any[]; current: any; docs: any[]; hasSecret: boolean; logs: any[]; recommended: any; recSessions: any[]; reqDocs: any[]; fields: any[]; clientKey: string; prod: boolean; method: string; banks: any[]; proofs: any[] };
const STEPS = ['Jadwal & sesi', 'Data diri', 'Akun SIAPkerja', 'Dokumen', 'Tinjau & kirim'];
const MAX = 10 * 1024 * 1024;

export default function Wizard(p: Props) {
  const router = useRouter();
  const { app, scheme } = p;
  const editable = ['draft', 'revision_required'].includes(app.status);
  const st = STATUS[app.status];
  const sp = useSearchParams();
  const [step, setStep] = useState(sp.get('langkah') === '2' && p.app.session_id ? 1 : 0);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const [pending, setPending] = useState(false);

  const done = useMemo(() => [
    !!app.session_id,
    ['full_name', 'nik', 'birth_place', 'birth_date', 'gender', 'address_ktp', 'city', 'province', 'phone', 'email', 'education', 'occupation', 'workplace'].every(k => !!app[k]) && app.experience_years != null
      && p.fields.filter(f => f.is_required).every(f => String(app.extra_answers?.[f.code] ?? '').trim() !== ''),
    !!app.siapkerja_email && !!app.siapkerja_phone && p.hasSecret,
    p.reqDocs.filter(d => d.is_required).every(d => p.docs.some(x => x.doc_type === d.code)),
    !!app.consent_at,
  ], [app, p.docs, p.hasSecret, p.reqDocs, p.fields]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string, next?: boolean) => {
    if (pending) return;
    setMsg(null); setPending(true);
    try {
      const r = await fn();
      if (!r.ok) { setMsg({ t: 'err', m: r.error || 'Gagal menyimpan.' }); return; }
      setMsg({ t: 'ok', m: okMsg });
      if (next) { setStep(s => Math.min(s + 1, STEPS.length - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      router.refresh();
    } catch {
      setMsg({ t: 'err', m: 'Koneksi terputus. Periksa internet Anda lalu coba lagi.' });
    } finally { setPending(false); }
  };

  return (
    <>
      {pending && <div className="topbar-loading" aria-hidden="true" />}
      <div className="row between" style={{ marginBottom: 8 }}>
        <div>
          <span className="eyebrow">Sertifikasi BNSP · {scheme.name}</span>
          <h1 style={{ marginBottom: 4 }}>Formulir pendaftaran</h1>
          <div className="row small"><span className={`badge ${st.tone}`}>{st.label}</span>{app.reg_code && <span className="muted">No. registrasi {app.reg_code}</span>}<span className="muted">{app.amount != null ? rupiah(app.amount) : 'Harga sesuai jadwal yang dipilih'}</span></div>
        </div>
        <a className="btn btn-outline" href="/akun">← Akun saya</a>
      </div>

      <StatusPanel {...p} run={run} pending={pending} />

      {editable && (
        <>
          {!app.coordinator_id && <ReferralBox id={app.id} />}
          <ol className="steps" aria-label="Langkah pendaftaran">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? 'active' : done[i] ? 'done' : ''}>
                <button type="button" onClick={() => { setStep(i); setMsg(null); }}><b>{done[i] ? '✓' : `0${i + 1}`}</b>{s}</button>
              </li>
            ))}
          </ol>
          {msg && <div className={`alert ${msg.t === 'ok' ? 'alert-ok' : 'alert-err'}`} role="status">{msg.m}</div>}
          <div className="card">
            {step === 0 && <StepSession {...p} run={run} pending={pending} />}
            {step === 1 && <StepPersonal {...p} run={run} pending={pending} />}
            {step === 2 && <StepSiapkerja {...p} run={run} pending={pending} />}
            {step === 3 && <StepDocs {...p} run={run} pending={pending} />}
            {step === 4 && <StepSubmit {...p} run={run} pending={pending} done={done} goto={setStep} />}
          </div>
          <p className="muted small center" style={{ marginTop: 14 }}>Semua isian tersimpan sebagai draft setiap kali Anda klik <b>Simpan</b>. Anda bisa keluar dan melanjutkan kapan saja.</p>
        </>
      )}
    </>
  );
}

type StepProps = Props & { run: (fn: () => Promise<any>, ok: string, next?: boolean) => void; pending: boolean };

/* ---------------- status (non-draft) ---------------- */
function StatusPanel(p: StepProps) {
  const { app, scheme } = p;
  const st = STATUS[app.status];
  const lastNote = p.logs.find(l => l.note)?.note || app.verifier_note;
  const [recSession, setRecSession] = useState<string>('');
  const recHasCurrent = p.recSessions.some(s => s.session_id === app.session_id);
  if (app.status === 'draft') return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p style={{ marginBottom: 8 }}>{st.desc}</p>
      {p.current && (
        <dl className="kv" style={{ marginBottom: 12 }}>
          <dt>Jadwal Ujikom</dt><dd>{tanggal(p.current.exam_schedules?.exam_date)}</dd>
          <dt>Sesi</dt><dd>{p.current.name} ({jam(p.current.start_time)}–{jam(p.current.end_time)} WIB)</dd>
          <dt>TUK</dt><dd>{p.current.exam_schedules?.tuk}</dd>
        </dl>
      )}
      {lastNote && ['revision_required', 'recommended', 'rejected'].includes(app.status) && (
        <div className="alert alert-warn"><b>Catatan verifikator:</b> {lastNote}</div>
      )}

      {app.status === 'recommended' && p.recommended && (
        <div className="card" style={{ background: '#FFFCF6', borderColor: '#E6D3A8' }}>
          <h2>Rekomendasi: {p.recommended.name}</h2>
          {(() => { const np = (p.recSessions.find(x => x.session_id === (recHasCurrent ? app.session_id : recSession)) || {}).price;
            return <p>Biaya berubah dari <s>{rupiah(app.amount)}</s> menjadi <b>{np != null ? rupiah(np) : '(pilih jadwal untuk melihat harga)'}</b>.</p>; })()}
          {!recHasCurrent && (
            <div className="field">
              <label htmlFor="rs">Jadwal Anda saat ini tidak tersedia untuk skema {p.recommended.name}. Pilih jadwal lain:</label>
              <select id="rs" value={recSession} onChange={e => setRecSession(e.target.value)}>
                <option value="">— pilih tanggal & sesi —</option>
                {p.recSessions.filter(s => s.seats_left > 0).map(s => <option key={s.session_id} value={s.session_id}>{tanggal(s.exam_date)} · {s.session_name} {jam(s.start_time)}–{jam(s.end_time)} · {s.tuk} · {rupiah(s.price)} (sisa {s.seats_left})</option>)}
              </select>
            </div>
          )}
          <div className="row">
            <button className="btn btn-primary" disabled={p.pending || (!recHasCurrent && !recSession)}
              onClick={() => p.run(() => acceptRecommendation(app.id, recHasCurrent ? undefined : recSession), 'Rekomendasi diterima. Silakan lanjutkan pembayaran.')}>Terima rekomendasi</button>
            <a className="btn btn-outline" target="_blank" rel="noopener" href={waLink(`Halo EMKI, saya ingin konsultasi tentang rekomendasi skema untuk pendaftaran ${app.reg_code}.`)}>Konsultasi dengan admin</a>
          </div>
        </div>
      )}

      {app.status === 'awaiting_payment' && <PayChoice {...p} />}

      {['submitted', 'recommended', 'awaiting_payment'].includes(app.status) && (
        <p className="small" style={{ marginTop: 14, marginBottom: 0 }}>
          <button className="btn btn-danger" style={{ padding: '7px 12px', fontSize: 13 }} disabled={p.pending}
            onClick={() => { if (confirm('Batalkan pendaftaran ini? Kursi Ujikom Anda akan dilepas.')) p.run(() => cancelApplication(app.id), 'Pendaftaran dibatalkan.'); }}>Batalkan pendaftaran</button>
        </p>
      )}
    </div>
  );
}

/* ---------------- pembayaran DOKU ---------------- */
function DokuPayBox(p: StepProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    // kembali dari halaman DOKU → cek status langsung
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('bayar')) {
      setChecking(true);
      checkPayment(p.app.id).then(() => { setChecking(false); router.replace(window.location.pathname); router.refresh(); });
    }
  }, []); // eslint-disable-line
  async function pay() {
    setErr(''); setBusy(true);
    const r = await createDokuPayment(p.app.id);
    if (!r.ok || !r.url) { setBusy(false); return setErr(r.error || 'Gagal membuka pembayaran.'); }
    window.location.href = r.url;
  }
  return (
    <div className="card" style={{ borderColor: 'var(--green-2)', background: '#FBFEFC', marginBottom: 0 }}>
      <div className="row between">
        <div><div className="muted small">Total pembayaran</div><div className="price">{rupiah(p.app.amount)}</div>
          <div className="small">Batas pembayaran: <b>{waktu(p.app.payment_due_at)}</b></div></div>
        <button className="btn btn-green" onClick={pay} disabled={busy || checking}>{busy ? 'Membuka…' : 'Bayar sekarang'}</button>
      </div>
      {checking && <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>Memeriksa status pembayaran…</div>}
      {err && <div className="alert alert-err" style={{ marginTop: 12, marginBottom: 0 }}>{err}</div>}
      <p className="muted small" style={{ margin: '12px 0 0' }}>Pembayaran aman melalui <b>DOKU</b>: Virtual Account bank, QRIS, e-wallet, kartu, dan metode lain yang tersedia. Status berubah otomatis setelah pembayaran berhasil.
        {' '}Sudah bayar tapi status belum berubah? <button type="button" onClick={async () => { setChecking(true); await checkPayment(p.app.id); setChecking(false); router.refresh(); }} style={{ background: 'none', border: 0, color: 'var(--blue)', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}>Cek status pembayaran</button></p>
    </div>
  );
}

/* ---------------- kode referral (opsional) ---------------- */
function ReferralBox({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [code, setCode] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (!open) return <p className="small" style={{ margin: '0 0 12px' }}>Mendaftar melalui koordinator? <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 0, color: 'var(--blue)', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}>Masukkan kode referral</button></p>;
  return (
    <div className="card" style={{ marginBottom: 14, padding: 16 }}>
      <div className="row"><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Kode referral, mis. SOFYAN" style={{ flex: 1, minWidth: 180, font: 'inherit', padding: '9px 12px', border: '1.5px solid #D5D8DC', borderRadius: 8, textTransform: 'uppercase' }} />
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={async () => { setErr(''); setBusy(true); const r = await applyReferral(id, code); setBusy(false); if (!r.ok) return setErr(r.error!); router.refresh(); }}>Gunakan kode</button></div>
      {err && <div className="alert alert-err" style={{ margin: '10px 0 0' }}>{err}</div>}
      <p className="muted small" style={{ margin: '8px 0 0' }}>Kode didapat dari koordinator yang mengajak Anda. Harga akan menyesuaikan.</p>
    </div>
  );
}

/* ---------------- pilihan metode bayar ---------------- */
function PayChoice(p: StepProps) {
  const [m, setM] = useState<'doku' | 'manual'>(p.method === 'manual' ? 'manual' : 'doku');
  if (p.method === 'manual') return <TransferBox {...p} />;
  if (p.method !== 'both') return <DokuPayBox {...p} />;
  const tab = (k: 'doku' | 'manual', t: string, d: string) => (
    <button type="button" onClick={() => setM(k)} style={{ flex: 1, minWidth: 150, textAlign: 'left', cursor: 'pointer', font: 'inherit', padding: '10px 12px', borderRadius: 10, border: `2px solid ${m === k ? 'var(--blue)' : 'var(--line)'}`, background: m === k ? 'var(--blue-soft)' : '#fff' }}>
      <b>{t}</b><div className="muted small">{d}</div></button>);
  return (<>
    <div className="lbl" style={{ marginBottom: 6 }}>Pilih cara pembayaran</div>
    <div className="row" style={{ gap: 8, marginBottom: 12, alignItems: 'stretch' }}>
      {tab('doku', '⚡ Bayar online', 'VA bank, QRIS, e-wallet · lunas otomatis')}
      {tab('manual', '🏦 Transfer manual', 'Transfer ke rekening BCA · upload bukti')}
    </div>
    {m === 'doku' ? <DokuPayBox {...p} /> : <TransferBox {...p} />}
  </>);
}

/* ---------------- transfer manual ---------------- */
function TransferBox(p: StepProps) {
  const router = useRouter();
  const [f, setF] = useState({ sender_name: p.app.full_name || '', sender_bank: '', transfer_date: new Date().toISOString().slice(0, 10) });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const rejected = p.proofs[0]?.status === 'rejected' ? p.proofs[0] : null;
  const copy = (t: string, k: string) => { navigator.clipboard?.writeText(t); setCopied(k); setTimeout(() => setCopied(''), 1500); };
  async function send(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!file) return setErr('Pilih file bukti transfer.');
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) return setErr('Format bukti harus JPG, PNG, atau PDF.');
    if (file.size > MAX) return setErr('Ukuran file maksimal 10 MB.');
    setBusy(true);
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${p.userId}/${p.app.id}/bukti-${Date.now()}.${ext}`;
    const { error } = await createClient().storage.from('application-documents').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setBusy(false); return setErr('Upload gagal: ' + error.message); }
    const r = await submitProof(p.app.id, { path, name: file.name, mime: file.type, size: file.size, ...f });
    setBusy(false);
    if (!r.ok) return setErr(r.error || 'Gagal mengirim bukti.');
    router.refresh();
  }
  return (
    <div className="card" style={{ borderColor: 'var(--green-2)', background: '#FBFEFC', marginBottom: 0 }}>
      {rejected && <div className="alert alert-warn"><b>Bukti sebelumnya belum bisa dikonfirmasi:</b> {rejected.review_note}</div>}
      <div className="muted small">Total yang harus ditransfer</div>
      <div className="row" style={{ alignItems: 'baseline' }}><span className="price">{rupiah(p.app.amount)}</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(String(p.app.amount), 'amt')}>{copied === 'amt' ? 'Tersalin ✓' : 'Salin nominal'}</button></div>
      <p className="small" style={{ margin: '4px 0 14px' }}>Batas pembayaran: <b>{waktu(p.app.payment_due_at)}</b></p>
      <div className="lbl">Transfer ke rekening berikut:</div>
      {p.banks.length === 0 && <div className="alert alert-warn">Rekening tujuan belum tersedia. Hubungi admin melalui WhatsApp.</div>}
      {p.banks.map((b: any) => (
        <div key={b.account_number} className="doc-link"><span><b>{b.bank}</b> · <span style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>{b.account_number}</span><div className="muted small">a.n. {b.account_name}</div></span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(b.account_number, b.account_number)}>{copied === b.account_number ? 'Tersalin ✓' : 'Salin'}</button></div>
      ))}
      <form onSubmit={send} style={{ marginTop: 16, borderTop: '1px dashed var(--line)', paddingTop: 16 }}>
        <h3>Sudah transfer? Konfirmasi di sini</h3>
        <div className="grid2">
          <div className="field"><label htmlFor="sn">Nama pengirim (sesuai rekening)</label><input id="sn" required value={f.sender_name} onChange={e => setF({ ...f, sender_name: e.target.value })} /></div>
          <div className="field"><label htmlFor="sb">Bank pengirim</label><input id="sb" required placeholder="mis. BCA, Mandiri, BRI" value={f.sender_bank} onChange={e => setF({ ...f, sender_bank: e.target.value })} /></div>
        </div>
        <div className="grid2">
          <div className="field"><label htmlFor="td">Tanggal transfer</label><input id="td" type="date" required max={new Date().toISOString().slice(0, 10)} value={f.transfer_date} onChange={e => setF({ ...f, transfer_date: e.target.value })} /></div>
          <div className="field"><label htmlFor="bf">Bukti transfer (JPG/PNG/PDF)</label><input id="bf" type="file" accept="image/jpeg,image/png,application/pdf" required onChange={e => setFile(e.target.files?.[0] || null)} /></div>
        </div>
        {err && <div className="alert alert-err">{err}</div>}
        <button className="btn btn-green" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim bukti transfer'}</button>
      </form>
    </div>
  );
}

/* ---------------- pembayaran (Midtrans Snap) ---------------- */
function PayBox(p: StepProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  function loadSnap(): Promise<any> {
    return new Promise((res, rej) => {
      const w = window as any; if (w.snap) return res(w.snap);
      const sc = document.createElement('script');
      sc.src = p.prod ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
      sc.setAttribute('data-client-key', p.clientKey); sc.onload = () => res(w.snap); sc.onerror = () => rej(new Error('Gagal memuat Midtrans'));
      document.body.appendChild(sc);
    });
  }
  async function pay() {
    setErr(''); setNote(''); setBusy(true);
    const r = await createPayment(p.app.id);
    if (!r.ok || !r.token) { setBusy(false); setErr(r.error || 'Gagal membuka pembayaran.'); return; }
    try {
      const snap = await loadSnap();
      snap.pay(r.token, {
        onSuccess: async () => { setNote('Pembayaran berhasil. Memperbarui status…'); await checkPayment(p.app.id); router.refresh(); },
        onPending: () => { setNote('Pembayaran menunggu penyelesaian. Selesaikan sesuai instruksi (mis. transfer ke nomor Virtual Account), status akan berubah otomatis.'); },
        onError: () => setErr('Pembayaran gagal. Silakan coba lagi atau gunakan metode lain.'),
        onClose: () => {},
      });
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div className="card" style={{ borderColor: 'var(--green-2)', background: '#FBFEFC', marginBottom: 0 }}>
      {!p.prod && <div className="alert alert-warn small">⚠️ <b>Mode uji coba pembayaran.</b> Jangan membayar dengan uang sungguhan di halaman ini. Jika Anda peserta, tim kami akan menghubungi Anda melalui WhatsApp untuk instruksi pembayaran.</div>}
      <div className="row between">
        <div><div className="muted small">Total pembayaran</div><div className="price">{rupiah(p.app.amount)}</div>
          <div className="small">Batas pembayaran: <b>{waktu(p.app.payment_due_at)}</b></div></div>
        <button className="btn btn-green" onClick={pay} disabled={busy}>{busy ? 'Membuka…' : 'Bayar sekarang'}</button>
      </div>
      {err && <div className="alert alert-err" style={{ marginTop: 12, marginBottom: 0 }}>{err}</div>}
      {note && <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>{note}</div>}
      <p className="muted small" style={{ margin: '12px 0 0' }}>Bisa dibayar dengan Virtual Account bank, QRIS, e-wallet, dan metode lain yang tersedia. Sudah bayar tapi status belum berubah?{' '}
        <button type="button" onClick={async () => { await checkPayment(p.app.id); router.refresh(); }} style={{ background: 'none', border: 0, color: 'var(--blue)', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}>Cek status pembayaran</button></p>
    </div>
  );
}

/* ---------------- step 1: jadwal ---------------- */
function StepSession(p: StepProps) {
  const [sel, setSel] = useState<string>(p.app.session_id || '');
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    p.sessions.forEach(s => { const k = s.schedule_id; m.set(k, [...(m.get(k) || []), s]); });
    return Array.from(m.values());
  }, [p.sessions]);
  const currentMissing = p.current && !p.sessions.some(s => s.session_id === p.current.id);
  return (
    <>
      <h2>Pilih tanggal & sesi Ujikom</h2>
      <p className="muted">Ketuk salah satu sesi — pilihan langsung tersimpan dan Anda lanjut ke langkah berikutnya. Sesi yang penuh tidak dapat dipilih.</p>
      {p.pending && <div className="alert alert-info">⏳ Menyimpan pilihan jadwal…</div>}
      {currentMissing && <div className="alert alert-warn">Sesi yang Anda pilih sebelumnya ({p.current.name}, {tanggal(p.current.exam_schedules?.exam_date)}) sudah ditutup. Silakan pilih sesi lain.</div>}
      {groups.length === 0 && <div className="alert alert-info">Belum ada jadwal Ujikom yang dibuka untuk skema ini. Anda tetap bisa melengkapi langkah lainnya; kami akan mengabari saat jadwal dibuka.</div>}
      {groups.map(g => (
        <div className="date-group" key={g[0].schedule_id}>
          <h3>{tanggal(g[0].exam_date)}</h3>
          <div className="muted small">{g[0].tuk}{g[0].address ? ` — ${g[0].address}` : ''}</div>
          {g.map(s => {
            const full = s.seats_left <= 0 && s.session_id !== p.app.session_id;
            return (
              <label key={s.session_id} className={`sess ${sel === s.session_id ? 'sel' : ''} ${full ? 'full' : ''}`}>
                <span><input type="radio" name="sess" disabled={full || p.pending} checked={sel === s.session_id}
                  onChange={() => { setSel(s.session_id); p.run(() => saveSession(p.app.id, s.session_id), `Jadwal tersimpan: ${s.session_name}, ${tanggal(s.exam_date)}.`, true); }} />
                  <b>{s.session_name}</b> · {jam(s.start_time)}–{jam(s.end_time)} WIB</span>
                <span className="row" style={{ gap: 8 }}><b className="small">{rupiah(s.price)}</b><span className={`badge ${full ? 'red' : s.seats_left <= 3 ? 'amber' : 'green'}`}>{full ? 'Penuh' : `Sisa ${s.seats_left} kursi`}</span></span>
              </label>
            );
          })}
        </div>
      ))}
      {sel && <button className="btn btn-primary" disabled={p.pending} onClick={() => p.run(() => saveSession(p.app.id, sel), 'Jadwal tersimpan.', true)}>{p.pending ? 'Menyimpan…' : 'Lanjut'}</button>}
    </>
  );
}

/* ---------------- step 2: data diri ---------------- */
function StepPersonal(p: StepProps) {
  const a = p.app;
  const [f, setF] = useState<Record<string, string>>({
    full_name: a.full_name || '', nik: a.nik || '', birth_place: a.birth_place || '', birth_date: a.birth_date || '',
    gender: a.gender || '', address_ktp: a.address_ktp || '', city: a.city || '', province: a.province || '',
    phone: a.phone || '', email: a.email || '', education: a.education || '', occupation: a.occupation || '',
    workplace: a.workplace || '', experience_years: a.experience_years == null ? '' : String(a.experience_years),
  });
  const [x, setX] = useState<Record<string, string>>(() => Object.fromEntries(p.fields.map(fl => [fl.code, String(a.extra_answers?.[fl.code] ?? '')])));
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const I = (k: string, label: string, extra: any = {}) => (
    <div className="field"><label htmlFor={k}>{label}</label><input id={k} value={f[k]} onChange={set(k)} {...extra} /></div>);
  return (
    <form onSubmit={e => { e.preventDefault(); p.run(() => savePersonal(a.id, f, x), 'Data diri tersimpan.', true); }}>
      <h2>Data diri</h2>
      <p className="muted">Isi sesuai KTP. Data ini dipakai untuk pendaftaran ke LSP dan penerbitan sertifikat.</p>
      {I('full_name', 'Nama lengkap (sesuai KTP)', { autoComplete: 'name' })}
      {I('nik', 'NIK (16 digit)', { inputMode: 'numeric', maxLength: 16, pattern: '[0-9]{16}', title: 'NIK 16 digit angka' })}
      <div className="grid2">
        {I('birth_place', 'Tempat lahir')}
        {I('birth_date', 'Tanggal lahir', { type: 'date', max: new Date().toISOString().slice(0, 10) })}
      </div>
      <div className="field"><span className="lbl">Jenis kelamin</span>
        <div className="row"><label className="check"><input type="radio" name="g" checked={f.gender === 'L'} onChange={() => setF({ ...f, gender: 'L' })} />Laki-laki</label>
          <label className="check"><input type="radio" name="g" checked={f.gender === 'P'} onChange={() => setF({ ...f, gender: 'P' })} />Perempuan</label></div></div>
      <div className="field"><label htmlFor="address_ktp">Alamat sesuai KTP</label><textarea id="address_ktp" rows={2} value={f.address_ktp} onChange={set('address_ktp')} /></div>
      <div className="grid2">
        {I('city', 'Kota / Kabupaten')}
        <div className="field"><label htmlFor="province">Provinsi</label><select id="province" value={f.province} onChange={set('province')}><option value="">— pilih —</option>{PROVINSI.map(x => <option key={x}>{x}</option>)}</select></div>
      </div>
      <div className="grid2">
        {I('phone', 'No. telepon / WhatsApp', { type: 'tel', inputMode: 'tel', placeholder: '08xxxxxxxxxx' })}
        {I('email', 'Email', { type: 'email' })}
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="education">Pendidikan terakhir</label><select id="education" value={f.education} onChange={set('education')}><option value="">— pilih —</option>{PENDIDIKAN.map(x => <option key={x}>{x}</option>)}</select></div>
        {I('experience_years', 'Lama pengalaman kerja di kitchen (tahun)', { type: 'number', min: 0, max: 60, step: 0.5, inputMode: 'decimal' })}
      </div>
      <div className="grid2">
        {I('occupation', 'Pekerjaan / jabatan', { placeholder: 'mis. Cook, Head Chef' })}
        {I('workplace', 'PT / institusi tempat bekerja', { placeholder: 'mis. SPPG ..., Hotel ...' })}
      </div>
      {p.fields.length > 0 && <h3 style={{ marginTop: 10 }}>Pertanyaan tambahan</h3>}
      {p.fields.map(fl => {
        const v = x[fl.code] || ''; const on = (e: any) => setX({ ...x, [fl.code]: e.target.value });
        const lbl = <label htmlFor={'x_' + fl.code}>{fl.label}{!fl.is_required && <span className="opt"> (opsional)</span>}</label>;
        return (<div className="field" key={fl.code}>{lbl}
          {fl.field_type === 'textarea' ? <textarea id={'x_' + fl.code} rows={3} value={v} onChange={on} required={fl.is_required} />
            : fl.field_type === 'select' ? <select id={'x_' + fl.code} value={v} onChange={on} required={fl.is_required}><option value="">— pilih —</option>{(fl.options || []).map((o: string) => <option key={o}>{o}</option>)}</select>
            : <input id={'x_' + fl.code} type={fl.field_type === 'number' ? 'number' : fl.field_type === 'date' ? 'date' : 'text'} value={v} onChange={on} required={fl.is_required} />}
          {fl.help_text && <div className="hint">{fl.help_text}</div>}</div>);
      })}
      <button className="btn btn-primary" disabled={p.pending}>{p.pending ? 'Menyimpan…' : 'Simpan & lanjut'}</button>
    </form>
  );
}

/* ---------------- step 3: SIAPkerja ---------------- */
function StepSiapkerja(p: StepProps) {
  const [f, setF] = useState({ email: p.app.siapkerja_email || '', phone: p.app.siapkerja_phone || '', password: '' });
  const [show, setShow] = useState(false);
  return (
    <form onSubmit={e => { e.preventDefault();
      if (!p.hasSecret && !f.password) return;
      p.run(() => saveSiapkerja(p.app.id, f), 'Data akun SIAPkerja tersimpan.', true); setF({ ...f, password: '' }); }}>
      <h2>Data akun SIAPkerja</h2>
      <p className="muted">Data akun SIAPkerja (Kemnaker) Anda dibutuhkan untuk proses pendaftaran sertifikasi ke LSP.</p>
      <div className="grid2">
        <div className="field"><label htmlFor="se">Email terdaftar di SIAPkerja</label><input id="se" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="sp">No. telepon terdaftar di SIAPkerja</label><input id="sp" type="tel" required value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      </div>
      <div className="field">
        <label htmlFor="spw">Password akun SIAPkerja</label>
        <input id="spw" type={show ? 'text' : 'password'} autoComplete="off" value={f.password} required={!p.hasSecret}
          placeholder={p.hasSecret ? '•••••••• (sudah tersimpan — isi hanya jika ingin mengganti)' : ''}
          onChange={e => setF({ ...f, password: e.target.value })} />
        <label className="check small" style={{ marginTop: 6 }}><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Tampilkan saat mengetik</label>
      </div>
      <div className="alert alert-info small">
        🔒 <b>Bagaimana password Anda dijaga:</b> dienkripsi sebelum disimpan, tidak dapat dilihat kembali dari akun ini, hanya dapat dibuka admin EMKI untuk keperluan pendaftaran (setiap akses tercatat), tidak ikut dalam file export, dan <b>dihapus otomatis 14 hari setelah Ujikom</b>. Kami menyarankan Anda mengganti password SIAPkerja setelah sertifikasi selesai.
      </div>
      <button className="btn btn-primary" disabled={p.pending}>{p.pending ? 'Menyimpan…' : 'Simpan & lanjut'}</button>
    </form>
  );
}

/* ---------------- step 4: dokumen ---------------- */
function StepDocs(p: StepProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>('');
  const [err, setErr] = useState('');
  async function upload(type: string, mimes: readonly string[], file?: File) {
    setErr('');
    if (!file) return;
    if (!mimes.includes(file.type)) { setErr(`Format file tidak sesuai untuk dokumen ini.`); return; }
    if (file.size > MAX) { setErr('Ukuran file maksimal 10 MB. Kompres file terlebih dahulu.'); return; }
    setBusy(type);
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${p.userId}/${p.app.id}/${type}-${Date.now()}.${ext}`;
    const { error } = await createClient().storage.from('application-documents').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setBusy(''); setErr('Upload gagal: ' + error.message); return; }
    const r = await recordDocument(p.app.id, { type, path, name: file.name, mime: file.type, size: file.size });
    setBusy('');
    if (!r.ok) { setErr(r.error || 'Gagal menyimpan dokumen.'); return; }
    router.refresh();
  }
  async function view(path: string) {
    const url = await getDocUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  }
  return (
    <>
      <h2>Upload dokumen</h2>
      <p className="muted">File tersimpan secara privat dan hanya dapat dibuka oleh Anda dan tim EMKI.</p>
      {err && <div className="alert alert-err">{err}</div>}
      {p.reqDocs.map((d, i) => {
        const cur = p.docs.find(x => x.doc_type === d.code); const acc = ACCEPT[d.accept] || ACCEPT.image_pdf;
        return (
          <div key={d.code} className={`doc ${cur ? 'ok' : ''}`}>
            <div className="ic">{cur ? '✓' : i + 1}</div>
            <div className="body">
              <div className="lbl" style={{ marginBottom: 2 }}>{d.name}{!d.is_required && <span className="opt" style={{ fontWeight: 400 }}> (opsional)</span>}</div>
              <div className="muted small">{d.description || `Format ${acc.label}, maksimal 10 MB.`}</div>
              {d.code === 'pas_foto' && (
                <details className="small" style={{ marginTop: 8 }} open={!cur}>
                  <summary><b>📸 Lihat contoh pas foto yang benar &amp; salah</b></summary>
                  <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
                    <li>Latar belakang <b>merah polos</b>, tampak depan, setengah badan (kepala sampai dada).</li>
                    <li>Pakaian rapi/formal, <b>tanpa kacamata hitam</b>, mulut tertutup (gigi tidak terlihat).</li>
                    <li><b>Bukan</b> selfie, bukan foto seluruh badan, bukan pose miring.</li>
                  </ul>
                  <a href="/contoh-pas-foto.jpg" target="_blank" rel="noopener"><img src="/contoh-pas-foto.jpg" alt="Contoh pas foto benar dan salah" style={{ width: '100%', maxWidth: 420, borderRadius: 8, border: '1px solid var(--line)' }} loading="lazy" /></a>
                </details>)}
              {d.code === 'qr_siapkerja' && (
                <details className="small" style={{ marginTop: 8 }} open={!cur}>
                  <summary><b>📱 Lihat contoh capture QR Code SIAPkerja</b></summary>
                  <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
                    <li>Buka aplikasi / situs <b>SIAPkerja</b>, lalu tampilkan <b>QR Code akun</b> Anda.</li>
                    <li>Screenshot <b>satu kartu utuh</b>: nama, NIK, dan QR Code harus terlihat jelas (tidak terpotong / buram).</li>
                    <li>Upload dalam format JPG atau PNG.</li>
                  </ul>
                  <a href="/contoh-qr-siapkerja.jpg" target="_blank" rel="noopener"><img src="/contoh-qr-siapkerja.jpg" alt="Contoh capture QR Code akun SIAPkerja" style={{ width: '100%', maxWidth: 220, borderRadius: 8, border: '1px solid var(--line)' }} loading="lazy" /></a>
                  <div className="muted" style={{ marginTop: 4 }}>Contoh disamarkan. Milik Anda harus terlihat jelas.</div>
                </details>)}
              {cur && <div className="fn">{cur.file_name} · <button type="button" className="small" style={{ background: 'none', border: 0, color: 'var(--blue)', cursor: 'pointer', padding: 0 }} onClick={() => view(cur.storage_path)}>lihat</button></div>}
              <label className="btn btn-outline" style={{ marginTop: 10, padding: '8px 14px', fontSize: 14 }}>
                {busy === d.code ? 'Mengunggah…' : cur ? 'Ganti file' : 'Pilih file'}
                <input type="file" accept={acc.accept} hidden disabled={!!busy} onChange={e => { upload(d.code, acc.mimes, e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        );
      })}
      <details className="small" style={{ margin: '6px 0 16px' }}>
        <summary><b>Cara menggabungkan CV, portfolio & paklaring menjadi 1 PDF</b></summary>
        <ol style={{ paddingLeft: 18 }}>
          <li>Buka situs penggabung PDF gratis, misalnya <b>ilovepdf.com → Merge PDF</b> (bisa dari HP).</li>
          <li>Unggah file berurutan: <b>CV → portfolio → paklaring</b>. Foto/scan JPG bisa diubah dulu lewat menu <b>JPG to PDF</b>.</li>
          <li>Klik <b>Merge</b>, unduh hasilnya, lalu upload di sini.</li>
        </ol>
      </details>
      <button className="btn btn-primary" disabled={!p.reqDocs.filter(d => d.is_required).every(d => p.docs.some(x => x.doc_type === d.code))}
        onClick={() => p.run(async () => ({ ok: true }), 'Dokumen lengkap.', true)}>Lanjut</button>
    </>
  );
}

/* ---------------- step 5: tinjau & kirim ---------------- */
function StepSubmit(p: StepProps & { done: boolean[]; goto: (i: number) => void }) {
  const [agree, setAgree] = useState(!!p.app.consent_at);
  const allDone = p.done.slice(0, 4).every(Boolean);
  const verify = p.scheme.requires_verification;
  const selPrice = (p.sessions.find(x => x.session_id === p.app.session_id) || {}).price ?? p.app.amount;
  return (
    <>
      <h2>Tinjau & kirim</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {STEPS.slice(0, 4).map((s, i) => (
          <li key={s} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{p.done[i] ? '✅' : '⬜'} {s}</span>
            {!p.done[i] && <button type="button" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => p.goto(i)}>Lengkapi</button>}
          </li>
        ))}
      </ul>
      <label className="check" style={{ margin: '18px 0' }}>
        <input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); saveConsent(p.app.id, e.target.checked); }} />
        <span>Saya menyatakan data yang saya isi benar, dan menyetujui data pribadi, dokumen, serta data akun SIAPkerja saya digunakan oleh EMKI dan LSP Rajawali Hospitality Nusantara <b>hanya untuk proses sertifikasi</b>. Saya bersedia dihubungi admin melalui WhatsApp/email.</span>
      </label>
      <div className="alert alert-info small">
        {verify
          ? <>Setelah dikirim, dokumen Anda diperiksa tim verifikator EMKI. Jika disetujui, Anda mendapat email untuk melanjutkan pembayaran <b>{rupiah(selPrice)}</b> dalam 3×24 jam.</>
          : <>Setelah dikirim, Anda dapat langsung melakukan pembayaran <b>{rupiah(selPrice)}</b> dalam 3×24 jam. Kursi Ujikom Anda ditahan selama masa tersebut.</>}
      </div>
      <button className="btn btn-primary btn-block" disabled={!allDone || !agree || p.pending}
        onClick={() => p.run(() => submitApplication(p.app.id), verify ? 'Pendaftaran terkirim dan sedang menunggu verifikasi.' : 'Pendaftaran terkirim. Silakan lanjutkan pembayaran.')}>
        {p.pending ? 'Mengirim…' : p.app.status === 'revision_required' ? 'Kirim ulang untuk verifikasi' : 'Kirim pendaftaran'}
      </button>
      {!allDone && <p className="muted small center" style={{ marginTop: 8 }}>Lengkapi semua langkah terlebih dahulu.</p>}
    </>
  );
}
