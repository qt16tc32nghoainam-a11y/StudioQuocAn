/**
 * Hàng đợi email + worker gửi lại.
 * Thao tác lưu lịch chỉ ghi vào email_outbox (nhanh, không chờ SMTP). Worker chạy nền gửi sau,
 * retry nếu SMTP tạm lỗi, chống gửi trùng bằng event_key.
 */
import { v4 as uuid } from 'uuid';
import { all, get, run, persist } from './db/database';
import { sendMail } from './mailer';
import { config } from './config';

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
}

function dateVN(s?: string | null): string {
  if (!s) return '(chưa có)';
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
}

export interface ShootMailInfo {
  code?: string;
  customer_name?: string;
  shoot_type?: string;
  shoot_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  title?: string;
  status?: string;
}

/** Dựng nội dung HTML email lịch chụp. kind: assigned | updated | cancelled */
function buildHtml(kind: 'assigned' | 'updated' | 'cancelled', roleLabel: string, s: ShootMailInfo): { subject: string; html: string } {
  const gio = s.start_time ? `${esc(s.start_time)}${s.end_time ? ' - ' + esc(s.end_time) : ''}` : '(cả ngày)';
  const tieuDe = kind === 'assigned'
    ? `[${config.appName}] Bạn được phân công lịch chụp ${esc(s.code)}`
    : kind === 'cancelled'
      ? `[${config.appName}] Lịch chụp ${esc(s.code)} đã bị hủy/gỡ phân công`
      : `[${config.appName}] Lịch chụp ${esc(s.code)} có thay đổi`;
  const loiMo = kind === 'assigned'
    ? `Bạn vừa được phân công (${esc(roleLabel)}) cho buổi chụp sau:`
    : kind === 'cancelled'
      ? `Buổi chụp bạn phụ trách (${esc(roleLabel)}) đã bị hủy hoặc bạn đã được gỡ khỏi lịch này:`
      : `Buổi chụp bạn phụ trách (${esc(roleLabel)}) vừa có thay đổi. Thông tin mới nhất:`;
  const html = `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2a221b">
    <h2 style="color:#9a6f2c;margin:0 0 6px">${config.appName}</h2>
    <p>${loiMo}</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <tr><td style="padding:6px 0;color:#8a7d70;width:130px">Mã buổi chụp</td><td style="padding:6px 0"><b>${esc(s.code)}</b></td></tr>
      <tr><td style="padding:6px 0;color:#8a7d70">Khách hàng</td><td style="padding:6px 0">${esc(s.customer_name)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7d70">Loại chụp</td><td style="padding:6px 0">${esc(s.shoot_type) || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7d70">Ngày chụp</td><td style="padding:6px 0"><b>${dateVN(s.shoot_date)}</b></td></tr>
      <tr><td style="padding:6px 0;color:#8a7d70">Giờ</td><td style="padding:6px 0">${gio}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7d70">Địa điểm</td><td style="padding:6px 0">${esc(s.location) || '—'}</td></tr>
      ${s.title ? `<tr><td style="padding:6px 0;color:#8a7d70">Ghi chú</td><td style="padding:6px 0">${esc(s.title)}</td></tr>` : ''}
    </table>
    <p style="color:#8a7d70;font-size:13px;margin-top:18px">Email tự động từ hệ thống quản trị ${config.appName}. Vui lòng không trả lời email này.</p>
  </div>`;
  return { subject: tieuDe, html };
}

/** Đưa 1 email phân công vào hàng đợi. */
export function enqueueShootMail(
  kind: 'assigned' | 'updated' | 'cancelled',
  recipient: { email?: string; name?: string },
  roleLabel: string,
  shoot: ShootMailInfo,
  dedupeSuffix: string
): void {
  if (!recipient.email) return;
  const { subject, html } = buildHtml(kind, roleLabel, shoot);
  const eventKey = `${shoot.code || 'NA'}:${recipient.email}:${kind}:${dedupeSuffix}`;
  insertOutbox(eventKey, recipient.email, recipient.name || '', subject, html);
}

// ===================== Email cho KHÁCH HÀNG =====================

export interface CustomerMailShoot {
  code?: string; customer_name?: string; shoot_type?: string; shoot_date?: string;
  package_name?: string; total_amount?: number;
}

function money(n: any): string {
  const v = Number(n) || 0;
  return v.toLocaleString('vi-VN') + 'đ';
}

/** Email xác nhận khi khách đã thanh toán đủ / chốt hợp đồng. */
export function enqueueContractConfirmed(email: string, customerName: string, s: CustomerMailShoot, studioName: string, dedupe: string): void {
  if (!email) return;
  const subject = `[${studioName}] Xác nhận hợp đồng chụp ${esc(s.code)}`;
  const html = `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2a221b">
    <h2 style="color:#9a6f2c;margin:0 0 6px">${esc(studioName)}</h2>
    <p>Chào ${esc(customerName)},</p>
    <p>${esc(studioName)} xác nhận đã nhận đủ thanh toán cho hợp đồng chụp của bạn. Cảm ơn bạn đã tin tưởng ❤</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <tr><td style="padding:6px 0;color:#8a7d70;width:140px">Mã hợp đồng</td><td style="padding:6px 0"><b>${esc(s.code)}</b></td></tr>
      <tr><td style="padding:6px 0;color:#8a7d70">Gói chụp</td><td style="padding:6px 0">${esc(s.package_name) || esc(s.shoot_type) || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#8a7d70">Ngày chụp</td><td style="padding:6px 0"><b>${dateVN(s.shoot_date)}</b></td></tr>
      <tr><td style="padding:6px 0;color:#8a7d70">Tổng giá trị</td><td style="padding:6px 0">${money(s.total_amount)}</td></tr>
    </table>
    <p>Chúng tôi sẽ liên hệ bạn về lịch chụp chi tiết. Nếu cần hỗ trợ, vui lòng phản hồi hoặc liên hệ hotline của studio.</p>
    <p style="color:#8a7d70;font-size:13px;margin-top:18px">Email tự động từ ${esc(studioName)}.</p>
  </div>`;
  insertOutbox(`${s.code}:${email}:contract:${dedupe}`, email, customerName, subject, html);
}

/** Email giao hình: gửi link ảnh cho khách khi đã hoàn thành. */
export function enqueuePhotosDelivered(email: string, customerName: string, s: CustomerMailShoot, link: string, method: string, studioName: string, dedupe: string): void {
  if (!email) return;
  const subject = `[${studioName}] Ảnh của bạn đã sẵn sàng — ${esc(s.code)}`;
  const linkBlock = link
    ? `<p style="margin:18px 0"><a href="${esc(link)}" style="background:#b98a3e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:600;display:inline-block">📷 Xem / Tải ảnh</a></p>
       <p style="font-size:13px;color:#8a7d70;word-break:break-all">Hoặc mở link: <a href="${esc(link)}">${esc(link)}</a></p>`
    : `<p>Vui lòng liên hệ studio để nhận ảnh${method ? ' qua ' + esc(method) : ''}.</p>`;
  const html = `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2a221b">
    <h2 style="color:#9a6f2c;margin:0 0 6px">${esc(studioName)}</h2>
    <p>Chào ${esc(customerName)},</p>
    <p>Bộ ảnh của bạn (mã ${esc(s.code)}${s.shoot_type ? ' · ' + esc(s.shoot_type) : ''}) đã hoàn thành và sẵn sàng để xem/tải.</p>
    ${linkBlock}
    <p>Cảm ơn bạn đã đồng hành cùng ${esc(studioName)}. Chúc bạn thật nhiều niềm vui với những khoảnh khắc đẹp ❤</p>
    <p style="color:#8a7d70;font-size:13px;margin-top:18px">Email tự động từ ${esc(studioName)}.</p>
  </div>`;
  insertOutbox(`${s.code}:${email}:photos:${dedupe}`, email, customerName, subject, html);
}

/** Chèn 1 bản ghi vào outbox (chống trùng bằng eventKey). */
function insertOutbox(eventKey: string, recipient: string, recipientName: string, subject: string, html: string): void {
  const existing = get<{ id: string }>('SELECT id FROM email_outbox WHERE event_key = ?', [eventKey]);
  if (existing) return;
  run(
    `INSERT INTO email_outbox (id, event_key, recipient, recipient_name, subject, html_body, status, attempts, next_attempt_at, created_at)
     VALUES (?,?,?,?,?,?, 'pending', 0, ?, ?)`,
    [uuid(), eventKey, recipient, recipientName || null, subject, html, new Date().toISOString(), new Date().toISOString()]
  );
  persist();
}

const MAX_ATTEMPTS = 5;

/** Worker: gửi các email pending tới hạn. Gọi định kỳ. */
export async function processOutbox(): Promise<void> {
  const now = new Date().toISOString();
  const pending = all<any>(
    `SELECT * FROM email_outbox WHERE status IN ('pending','failed') AND attempts < ?
     AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY created_at ASC LIMIT 10`,
    [MAX_ATTEMPTS, now]
  );
  for (const m of pending) {
    run("UPDATE email_outbox SET status='sending' WHERE id=?", [m.id]);
    try {
      await sendMail(m.recipient, m.subject, m.html_body);
      run("UPDATE email_outbox SET status='sent', sent_at=?, last_error=NULL WHERE id=?", [new Date().toISOString(), m.id]);
    } catch (e: any) {
      const attempts = (m.attempts || 0) + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      // backoff: 1,5,15,30,60 phút
      const delays = [1, 5, 15, 30, 60];
      const next = new Date(Date.now() + (delays[Math.min(attempts - 1, delays.length - 1)] || 60) * 60000).toISOString();
      run(
        "UPDATE email_outbox SET status=?, attempts=?, last_error=?, next_attempt_at=? WHERE id=?",
        [failed ? 'failed' : 'pending', attempts, String(e?.message || e).slice(0, 300), next, m.id]
      );
    }
  }
  persist();
}

/** Bắt đầu worker nền (mỗi 30 giây). */
export function startOutboxWorker(): void {
  setInterval(() => { processOutbox().catch((e) => console.error('[outbox] lỗi:', e)); }, 30000);
  // chạy sớm 1 lần sau 5 giây
  setTimeout(() => { processOutbox().catch(() => {}); }, 5000);
}
