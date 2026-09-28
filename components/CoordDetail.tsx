'use client';
import { useState, useTransition } from 'react';
import { STATUS, jam, rupiah, tanggal } from '@/lib/format';
import { revealSecret } from '@/app/admin/actions';
import StaffDocUpload from '@/components/admin/StaffDocUpload';

export default function CoordDetail(p: any) {
  const { a } = p; const st = STATUS[a.status]; const s = a.exam_sessions, j = s?.exam_schedules;
  const [pending, start] = useTransition();
  const [secret, setSecret] = useState(''); const [reason, setReason] = useState('Input ke Sisfo BNSP'); const [err, setErr] = useState('');
  return (<>
    <a href="/koordinator" className="small">← Peserta saya</a>
    <div className="row between"><div><h1 style={{ margin: '6px 0 4px' }}>{a.full_name || '(nama belum diisi)'}</h1>
      <div className="row small"><span className={`badge ${st.tone}`}>{st.label}</span><span>{a.schemes?.name}</span><span className="muted">{a.reg_code}</span>{a.amount != null && <span className="muted">{rupiah(a.amount)}</span>}</div></div>
      {a.reg_code && <a className="btn btn-outline btn-sm" href={`/admin/export?ids=${a.id}`}>⬇ Download peserta ini</a>}</div>
    {err && <div className="alert alert-err" style={{ marginTop: 12 }}>{err}</div>}
    <div className="grid2" style={{ marginTop: 16, alignItems: 'start' }}>
      <div>
        <div className="card"><h2>Screenshot Sisfo BNSP</h2>
          <StaffDocUpload appId={a.id} ownerId={a.user_id} docs={p.staffDocs} current={p.docs} urls={p.urls} /></div>
        <div className="card"><h2>Akun SIAPkerja</h2>
          <dl className="kv"><dt>Email</dt><dd>{a.siapkerja_email || '-'}</dd><dt>No. telepon</dt><dd>{a.siapkerja_phone || '-'}</dd>
            <dt>Password</dt><dd>{secret ? <span className="secret">{secret}</span> : p.hasSecret ? '•••••••• (terenkripsi)' : 'Tidak tersedia / sudah dihapus otomatis'}</dd></dl>
          {p.hasSecret && !secret && <div className="row" style={{ marginTop: 12 }}>
            <input value={reason} onChange={e => setReason(e.target.value)} style={{ flex: 1, minWidth: 200, font: 'inherit', padding: '8px 10px', border: '1.5px solid #D5D8DC', borderRadius: 8 }} />
            <button className="btn btn-outline btn-sm" disabled={pending} onClick={() => start(async () => { setErr(''); const r = await revealSecret(a.id, reason); if (!r.ok) return setErr(r.error!); setSecret(r.data); setTimeout(() => setSecret(''), 60000); })}>🔓 Tampilkan password</button></div>}
          {secret && <p className="muted small">Disembunyikan lagi dalam 60 detik. Akses ini tercatat.</p>}
        </div>
        <div className="card"><h2>Data peserta</h2>
          <dl className="kv"><dt>NIK</dt><dd>{a.nik}</dd><dt>Tempat, tgl lahir</dt><dd>{a.birth_place}, {a.birth_date ? tanggal(a.birth_date) : '-'}</dd>
            <dt>Jenis kelamin</dt><dd>{a.gender === 'L' ? 'Laki-laki' : a.gender === 'P' ? 'Perempuan' : '-'}</dd><dt>Alamat KTP</dt><dd>{a.address_ktp}</dd>
            <dt>Kota / Provinsi</dt><dd>{a.city} / {a.province}</dd><dt>Telp / WA</dt><dd>{a.phone}</dd><dt>Email</dt><dd>{a.email}</dd>
            <dt>Pendidikan</dt><dd>{a.education}</dd><dt>Pekerjaan</dt><dd>{a.occupation}</dd><dt>PT / Institusi</dt><dd>{a.workplace}</dd><dt>Pengalaman</dt><dd>{a.experience_years ?? '-'} tahun</dd></dl></div>
      </div>
      <div>
        <div className="card"><h2>Dokumen peserta</h2>
          {p.partDocs.map((d: any) => { const cur = p.docs.find((x: any) => x.doc_type === d.code); return (
            <div className="doc-link" key={d.code}><span><b>{d.name}</b><div className="muted small">{cur ? cur.file_name : 'Belum diunggah'}</div></span>
              {p.urls[d.code] && <a className="btn btn-outline btn-sm" href={p.urls[d.code]} target="_blank" rel="noopener">Buka</a>}</div>); })}</div>
        <div className="card"><h2>Jadwal & pembayaran</h2>
          <dl className="kv">{j ? <><dt>Tanggal</dt><dd>{tanggal(j.exam_date)}</dd><dt>Sesi</dt><dd>{s.name} ({jam(s.start_time)}–{jam(s.end_time)})</dd><dt>TUK</dt><dd>{j.tuk}</dd></> : <><dt>Jadwal</dt><dd>Belum dipilih</dd></>}
            <dt>Harga dasar</dt><dd>{a.base_amount != null ? rupiah(a.base_amount) : '-'}</dd><dt>Markup</dt><dd>{a.markup_amount ? rupiah(a.markup_amount) : '-'}</dd>
            <dt>Dibayar peserta</dt><dd>{a.amount != null ? rupiah(a.amount) : '-'}</dd><dt>Komisi Anda</dt><dd><b>{a.commission_amount != null ? rupiah(a.commission_amount) : '-'}</b>{a.markup_paid_at ? ' · sudah dibayarkan' : ''}</dd></dl></div>
        {a.verifier_note && ['revision_required', 'recommended', 'rejected'].includes(a.status) && <div className="alert alert-warn"><b>Catatan verifikator:</b> {a.verifier_note}</div>}
      </div>
    </div>
  </>);
}
