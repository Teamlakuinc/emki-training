import 'server-only';
import nodemailer from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/admin';
import { fillTemplate, varsFor } from '@/lib/templates';

let transporter: nodemailer.Transporter | null = null;
function tx() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
function html(body: string) {
  const text = esc(body).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#004AAD">$1</a>').replace(/\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1C1C22;max-width:560px;margin:auto">
  <div style="padding:18px 0;border-bottom:3px solid #004AAD;margin-bottom:18px"><b style="font-size:18px;color:#004AAD">EMKI — Sertifikasi Kompetensi</b></div>
  ${text}
  <p style="margin-top:28px;font-size:12px;color:#8D939C">Email otomatis dari training.edukasikuliner.com. Butuh bantuan? Balas email ini atau hubungi WhatsApp admin.</p></div>`;
}

/** Kirim email template ke peserta pendaftaran. Tidak pernah melempar error (gagal kirim cukup dicatat). */
export async function sendAppEmail(appId: string, key: string): Promise<boolean> {
  try {
    const t = tx(); if (!t) return false;
    const db = createAdminClient();
    const [{ data: tpl }, { data: a }] = await Promise.all([
      db.from('message_templates').select('subject,body,is_active').eq('key', key).maybeSingle(),
      db.from('applications').select('id,reg_code,full_name,email,amount,payment_due_at,verifier_note,schemes!applications_scheme_id_fkey(name),rec:schemes!applications_recommended_scheme_id_fkey(name),exam_sessions(name,start_time,end_time,exam_schedules(exam_date,tuk,address))').eq('id', appId).maybeSingle(),
    ]);
    if (!tpl || !tpl.is_active || !a?.email) return false;
    const { data: u } = await db.from('applications').select('user_id').eq('id', appId).single();
    const { data: prof } = await db.from('profiles').select('email').eq('id', u!.user_id).single();
    const vars = varsFor(a, process.env.NEXT_PUBLIC_SITE_URL || '');
    const to = Array.from(new Set([a.email, prof?.email].filter(Boolean))).join(', ');
    await t.sendMail({
      from: process.env.SMTP_FROM || `EMKI Sertifikasi <${process.env.SMTP_USER}>`, to, replyTo: process.env.SMTP_USER,
      subject: fillTemplate(tpl.subject || 'Informasi pendaftaran sertifikasi', vars), text: fillTemplate(tpl.body, vars), html: html(fillTemplate(tpl.body, vars)),
    });
    await db.from('notification_logs').insert({ application_id: appId, channel: 'email', template_key: key });
    return true;
  } catch (e) { console.error('email gagal', key, e); return false; }
}
