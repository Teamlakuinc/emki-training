import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Enkripsi AES-256-GCM. Format: v1:<base64(iv[12] | tag[16] | ciphertext)> */
function key(): Buffer {
  const raw = process.env.SIAPKERJA_ENC_KEY;
  if (!raw) throw new Error('SIAPKERJA_ENC_KEY belum diisi');
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new Error('SIAPKERJA_ENC_KEY harus 32 byte (buat dengan: openssl rand -base64 32)');
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith('v1:')) throw new Error('Format tidak dikenal');
  const buf = Buffer.from(payload.slice(3), 'base64');
  const d = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
