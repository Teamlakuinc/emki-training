'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DOCS, PENDIDIKAN, PROVINSI, STATUS, jam, rupiah, tanggal, waktu, waLink } from '@/lib/format';
import {
  saveSession, savePersonal, saveSiapkerja, recordDocument, getDocUrl, saveConsent,
  submitApplication, acceptRecommendation, cancelApplication,
} from '@/app/akun/actions';

type Props = { app: any; scheme: any; userId: string; sessions: any[]; current: any; docs: any[]; hasSecret: boolean; logs: any[]; recommended: any; recSessions: any[] };
const STEPS = ['Jadwal & sesi', 'Data diri', 'Akun SIAPkerja', 'Dokumen', 'Tinjau & kirim'];
const MAX = 10 * 1024 * 1024;

export default function Wizard(p: Props) {
  const router = useRouter();
  const { app, scheme } = p;
  const editable = ['draft', 'revision_required'].includes(app.status);
  const st = STATUS[app.status];
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const [pending, start] = useTransition();

  const done = useMemo(() => [
    !!app.session_id,
    ['full_name', 'nik', 'birth_place', 'birth_date', 'gender', 'address_ktp', 'city', 'province', 'phone', 'email', 'education', 'occupation', 'workplace'].every(k => !!app[k]) && app.experience_years != null,
    !!app.siapkerja_email && !!app.siapkerja_phone && p.hasSecret,
    DOCS.every(d => p.docs.some(x => x.doc_type === d.type)),
    !!app.consent_at,
  ], [app, p.docs, p.hasSecret]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string, next?: boolean) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (!r.ok) { setMsg({ t: 'err', m: r.error || 'Gagal menyimpan.' }); return; }
      setMsg({ t: 'ok', m: okMsg });
      router.refresh();
      if (next) { setStep(s => Math.min(s + 1, STEPS.length - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });

  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div>
          <span className="eyebrow">Sertifikasi BNSP · {scheme.name}</span>
          <h1 style={{ marginBottom: 4 }}>Formulir pendaftaran</h1>
          <div className="row small"><span className={`badge ${st.tone}`}>{st.label}</span>{app.reg_code && <span className="muted">No. registrasi {app.reg_code}</span>}<span className="muted">{rupiah(app.amount ?? scheme.price)}</span></div>
        </div>
        <a className="btn btn-outline" href="/akun">← Akun saya</a>
      </div>

      <StatusPanel {...p} run={run} pending={pending} />

      {editable && (
        <>
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
          <p>Biaya berubah dari <s>{rupiah(app.amount ?? scheme.price)}</s> menjadi <b>{rupiah(p.recommended.price)}</b>.</p>
          {!recHasCurrent && (
            <div className="field">
              <label htmlFor="rs">Jadwal Anda saat ini tidak tersedia untuk skema {p.recommended.name}. Pilih jadwal lain:</label>
              <select id="rs" value={recSession} onChange={e => setRecSession(e.target.value)}>
                <option value="">— pilih tanggal & sesi —</option>
                {p.recSessions.filter(s => s.seats_left > 0).map(s => <option key={s.session_id} value={s.session_id}>{tanggal(s.exam_date)} · {s.session_name} {jam(s.start_time)}–{jam(s.end_time)} · {s.tuk} (sisa {s.seats_left})</option>)}
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

      {app.status === 'awaiting_payment' && (
        <div className="alert alert-info" style={{ marginBottom: 0 }}>
          <b>Total: {rupiah(app.amount)}</b> · Batas pembayaran: <b>{waktu(app.payment_due_at)}</b><br />
          Pembayaran online akan segera aktif di halaman ini. Sementara itu, tim kami akan menghubungi Anda melalui WhatsApp untuk instruksi pembayaran.
        </div>
      )}

      {['submitted', 'recommended', 'awaiting_payment'].includes(app.status) && (
        <p className="small" style={{ marginTop: 14, marginBottom: 0 }}>
          <button className="btn btn-danger" style={{ padding: '7px 12px', fontSize: 13 }} disabled={p.pending}
            onClick={() => { if (confirm('Batalkan pendaftaran ini? Kursi Ujikom Anda akan dilepas.')) p.run(() => cancelApplication(app.id), 'Pendaftaran dibatalkan.'); }}>Batalkan pendaftaran</button>
        </p>
      )}
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
      <p className="muted">Pilih satu sesi. Sesi yang penuh tidak dapat dipilih.</p>
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
                <span><input type="radio" name="sess" disabled={full} checked={sel === s.session_id} onChange={() => setSel(s.session_id)} />
                  <b>{s.session_name}</b> · {jam(s.start_time)}–{jam(s.end_time)} WIB</span>
                <span className={`badge ${full ? 'red' : s.seats_left <= 3 ? 'amber' : 'green'}`}>{full ? 'Penuh' : `Sisa ${s.seats_left} kursi`}</span>
              </label>
            );
          })}
        </div>
      ))}
      <button className="btn btn-primary" disabled={!sel || p.pending} onClick={() => p.run(() => saveSession(p.app.id, sel), 'Jadwal tersimpan.', true)}>Simpan & lanjut</button>
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
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const I = (k: string, label: string, extra: any = {}) => (
    <div className="field"><label htmlFor={k}>{label}</label><input id={k} value={f[k]} onChange={set(k)} {...extra} /></div>);
  return (
    <form onSubmit={e => { e.preventDefault(); p.run(() => savePersonal(a.id, f), 'Data diri tersimpan.', true); }}>
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
      {DOCS.map((d, i) => {
        const cur = p.docs.find(x => x.doc_type === d.type);
        return (
          <div key={d.type} className={`doc ${cur ? 'ok' : ''}`}>
            <div className="ic">{cur ? '✓' : i + 1}</div>
            <div className="body">
              <div className="lbl" style={{ marginBottom: 2 }}>{d.label}</div>
              <div className="muted small">{d.hint}</div>
              {cur && <div className="fn">{cur.file_name} · <button type="button" className="small" style={{ background: 'none', border: 0, color: 'var(--blue)', cursor: 'pointer', padding: 0 }} onClick={() => view(cur.storage_path)}>lihat</button></div>}
              <label className="btn btn-outline" style={{ marginTop: 10, padding: '8px 14px', fontSize: 14 }}>
                {busy === d.type ? 'Mengunggah…' : cur ? 'Ganti file' : 'Pilih file'}
                <input type="file" accept={d.accept} hidden disabled={!!busy} onChange={e => { upload(d.type, d.mimes, e.target.files?.[0]); e.target.value = ''; }} />
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
      <button className="btn btn-primary" disabled={!DOCS.every(d => p.docs.some(x => x.doc_type === d.type))}
        onClick={() => p.run(async () => ({ ok: true }), 'Dokumen lengkap.', true)}>Lanjut</button>
    </>
  );
}

/* ---------------- step 5: tinjau & kirim ---------------- */
function StepSubmit(p: StepProps & { done: boolean[]; goto: (i: number) => void }) {
  const [agree, setAgree] = useState(!!p.app.consent_at);
  const allDone = p.done.slice(0, 4).every(Boolean);
  const verify = p.scheme.requires_verification;
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
        <span>Saya menyatakan data yang saya isi benar, dan menyetujui data pribadi, dokumen, serta data akun SIAPkerja saya digunakan oleh EMKI dan LSP Rajawali <b>hanya untuk proses sertifikasi</b>. Saya bersedia dihubungi admin melalui WhatsApp/email.</span>
      </label>
      <div className="alert alert-info small">
        {verify
          ? <>Setelah dikirim, dokumen Anda diperiksa tim verifikator EMKI. Jika disetujui, Anda mendapat email untuk melanjutkan pembayaran <b>{rupiah(p.scheme.price)}</b> dalam 3×24 jam.</>
          : <>Setelah dikirim, Anda dapat langsung melakukan pembayaran <b>{rupiah(p.scheme.price)}</b> dalam 3×24 jam. Kursi Ujikom Anda ditahan selama masa tersebut.</>}
      </div>
      <button className="btn btn-primary btn-block" disabled={!allDone || !agree || p.pending}
        onClick={() => p.run(() => submitApplication(p.app.id), verify ? 'Pendaftaran terkirim dan sedang menunggu verifikasi.' : 'Pendaftaran terkirim. Silakan lanjutkan pembayaran.')}>
        {p.pending ? 'Mengirim…' : p.app.status === 'revision_required' ? 'Kirim ulang untuk verifikasi' : 'Kirim pendaftaran'}
      </button>
      {!allDone && <p className="muted small center" style={{ marginTop: 8 }}>Lengkapi semua langkah terlebih dahulu.</p>}
    </>
  );
}
