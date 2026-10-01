/**
 * Dịch vụ gửi email qua SMTP.
 * - Cấu hình SMTP lưu trong app_settings (key 'smtp.*'); mật khẩu được MÃ HÓA trước khi lưu.
 * - transport được cache, tự làm mới khi cấu hình đổi (reloadMailer()).
 * - Không bao giờ trả mật khẩu về client; chỉ cho biết đã cấu hình hay chưa.
 */
import crypto from 'crypto';
import nodemailer, { Transporter } from 'nodemailer';
import { config } from './config';
import { getSettingsByPrefix, setSetting } from './db/database';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;      // true = cổng 465
  user: string;
  pass: string;         // đã giải mã (chỉ dùng nội bộ)
  fromName: string;
  fromEmail: string;
  enabled: boolean;
}

// ---- Mã hóa secret (AES-256-GCM) ----
function key(): Buffer {
  return crypto.createHash('sha256').update(config.encryptionKey).digest();
}
export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}
export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith('enc:')) return stored; // tương thích giá trị cũ chưa mã hóa
  try {
    const raw = Buffer.from(stored.slice(4), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

/** Đọc cấu hình SMTP từ DB (mật khẩu đã giải mã). */
export function readSmtpConfig(): SmtpConfig {
  const s = getSettingsByPrefix('smtp.');
  return {
    host: s.host || '',
    port: parseInt(s.port || '587', 10),
    secure: s.secure === 'true',
    user: s.user || '',
    pass: decryptSecret(s.pass || ''),
    fromName: s.fromName || config.appName,
    fromEmail: s.fromEmail || s.user || '',
    enabled: s.enabled === 'true',
  };
}

/** Lưu cấu hình SMTP. Nếu pass rỗng -> giữ mật khẩu cũ. */
export function saveSmtpConfig(input: Partial<SmtpConfig> & { pass?: string }, updatedBy?: string): void {
  if (input.host !== undefined) setSetting('smtp.host', String(input.host), updatedBy);
  if (input.port !== undefined) setSetting('smtp.port', String(input.port), updatedBy);
  if (input.secure !== undefined) setSetting('smtp.secure', input.secure ? 'true' : 'false', updatedBy);
  if (input.user !== undefined) setSetting('smtp.user', String(input.user), updatedBy);
  if (input.fromName !== undefined) setSetting('smtp.fromName', String(input.fromName), updatedBy);
  if (input.fromEmail !== undefined) setSetting('smtp.fromEmail', String(input.fromEmail), updatedBy);
  if (input.enabled !== undefined) setSetting('smtp.enabled', input.enabled ? 'true' : 'false', updatedBy);
  if (input.pass) setSetting('smtp.pass', encryptSecret(String(input.pass)), updatedBy);
  _transport = null; // làm mới transport
}

/** Trạng thái cấu hình để trả về client (KHÔNG kèm mật khẩu). */
export function smtpStatus() {
  const c = readSmtpConfig();
  return {
    host: c.host,
    port: c.port,
    secure: c.secure,
    user: c.user,
    fromName: c.fromName,
    fromEmail: c.fromEmail,
    enabled: c.enabled,
    passwordConfigured: !!c.pass,
    ready: !!(c.enabled && c.host && c.user && c.pass),
  };
}

let _transport: Transporter | null = null;
function transport(): Transporter | null {
  const c = readSmtpConfig();
  if (!c.enabled || !c.host || !c.user || !c.pass) return null;
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: { user: c.user, pass: c.pass },
    });
  }
  return _transport;
}

export function reloadMailer(): void {
  _transport = null;
}

/** Gửi 1 email. Ném lỗi nếu chưa cấu hình / gửi thất bại (để worker retry). */
export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const t = transport();
  if (!t) throw new Error('SMTP chưa được cấu hình hoặc đang tắt');
  const c = readSmtpConfig();
  const from = c.fromName ? `${c.fromName} <${c.fromEmail}>` : c.fromEmail;
  await t.sendMail({ from, to, subject, html });
}

/** Kiểm tra kết nối SMTP (nút Test). */
export async function verifySmtp(): Promise<void> {
  const t = transport();
  if (!t) throw new Error('SMTP chưa được cấu hình hoặc đang tắt');
  await t.verify();
}
