/**
 * Nhắc tự động (chạy nền). Mỗi lượt quét:
 *  1) Buổi chụp sắp tới (còn <= 2 ngày, chưa hủy) -> nhắc Photo/Makeup được gán + Admin (chuông + mail nhân viên).
 *  2) Giao hình tới hạn / quá hạn (chưa giao) -> nhắc người phụ trách giao hình + Sale (chuông).
 *  3) Buổi đã qua ngày chụp mà chưa thu đủ tiền -> nhắc Sale (Admin/Makeup) thu nốt (chuông).
 * Chống trùng bằng dedupe_key gắn theo NGÀY (mỗi mốc nhắc 1 lần/ngày).
 */
import { all, get } from './db/database';
import { pushNotify, enqueueReminderMail } from './notifications';
import { config } from './config';

function today(): string { return new Date().toISOString().slice(0, 10); }
function addDays(base: string, d: number): string {
  const dt = new Date(base + 'T00:00:00'); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10);
}

/** Danh sách Admin đang hoạt động (nhận bản sao thông báo quản lý). */
function adminIds(): string[] {
  return all<{ id: string }>("SELECT id FROM users WHERE role = 'Admin' AND status = 'Hoạt động'").map((u) => u.id);
}
function saleIds(): string[] {
  return all<{ id: string }>("SELECT id FROM users WHERE role IN ('Admin','Makeup') AND status = 'Hoạt động'").map((u) => u.id);
}
function userEmail(id: string): { email?: string; full_name?: string } | null {
  return get<any>('SELECT email, full_name FROM users WHERE id = ? AND status = \'Hoạt động\'', [id]) || null;
}

/** 1) Buổi chụp sắp tới trong 2 ngày. */
function remindUpcomingShoots(): void {
  const t = today();
  const limit = addDays(t, 2);
  const rows = all<any>(
    `SELECT s.id, s.code, s.shoot_type, s.shoot_date, s.start_time, s.location, s.photographer_id, s.makeup_id,
            c.full_name AS customer_name
     FROM shoots s JOIN customers c ON c.id = s.customer_id
     WHERE s.status != 'Đã hủy' AND s.shoot_date IS NOT NULL AND s.shoot_date >= ? AND s.shoot_date <= ?`,
    [t, limit]
  );
  const admins = adminIds();
  for (const s of rows) {
    const when = s.shoot_date === t ? 'HÔM NAY' : (s.shoot_date === addDays(t, 1) ? 'NGÀY MAI' : s.shoot_date);
    const title = `Sắp tới: buổi chụp ${s.code} ${when}`;
    const body = `${s.customer_name} · ${s.shoot_type || ''}${s.start_time ? ' · ' + s.start_time : ''}${s.location ? ' · ' + s.location : ''}`;
    const link = `/buoi-chup?q=${encodeURIComponent(s.code)}`;
    const key = (uid: string) => `shoot_soon:${s.id}:${s.shoot_date}:${uid}`;
    // Nhân viên được gán + Admin
    const targets = new Set<string>([...admins]);
    if (s.photographer_id) targets.add(s.photographer_id);
    if (s.makeup_id) targets.add(s.makeup_id);
    for (const uid of targets) {
      const created = pushNotify(uid, { type: 'shoot_soon', title, body, link, dedupeKey: key(uid) });
      // Gửi mail nhắc cho nhân viên trực tiếp phụ trách (không spam toàn bộ Admin).
      if (created && (uid === s.photographer_id || uid === s.makeup_id)) {
        const u = userEmail(uid);
        if (u?.email) enqueueReminderMail(u.email, u.full_name || '', title, body, config.appName, `${key(uid)}:mail`);
      }
    }
  }
}

/** 2) Giao hình tới hạn / quá hạn (chưa giao). */
function remindDeliveries(): void {
  const t = today();
  const rows = all<any>(
    `SELECT d.id, d.shoot_id, d.editor_id, COALESCE(d.promised_date, d.due_date) AS deadline,
            s.code, s.photographer_id, s.makeup_id, c.full_name AS customer_name
     FROM deliveries d JOIN shoots s ON s.id = d.shoot_id JOIN customers c ON c.id = s.customer_id
     WHERE d.delivered = 0 AND COALESCE(d.promised_date, d.due_date) IS NOT NULL
       AND COALESCE(d.promised_date, d.due_date) <= ?`,
    [t]
  );
  const admins = adminIds();
  for (const d of rows) {
    const overdue = d.deadline < t;
    const title = overdue ? `Quá hạn giao hình: ${d.code}` : `Tới hạn giao hình hôm nay: ${d.code}`;
    const body = `${d.customer_name} · hạn ${d.deadline}${overdue ? ' (đã quá hạn)' : ''}`;
    const link = `/giao-hinh?filter=overdue`;
    const key = (uid: string) => `delivery_due:${d.id}:${d.deadline}:${uid}`;
    const targets = new Set<string>([...admins]);
    if (d.editor_id) targets.add(d.editor_id);
    if (d.photographer_id) targets.add(d.photographer_id);
    for (const uid of targets) {
      pushNotify(uid, { type: 'delivery_due', title, body, link, dedupeKey: key(uid) });
    }
  }
}

/** 3) Buổi đã qua ngày chụp mà chưa thu đủ -> nhắc Sale thu nốt. */
function remindPaymentDue(): void {
  const t = today();
  const rows = all<any>(
    `SELECT s.id, s.code, s.total_amount, s.shoot_date, c.full_name AS customer_name,
            COALESCE((SELECT SUM(so_tien) FROM payments p WHERE p.shoot_id = s.id), 0) AS paid
     FROM shoots s JOIN customers c ON c.id = s.customer_id
     WHERE s.status != 'Đã hủy' AND s.paid_full = 0 AND s.total_amount > 0
       AND s.shoot_date IS NOT NULL AND s.shoot_date < ?`,
    [t]
  );
  const sales = saleIds();
  for (const s of rows) {
    const remaining = Math.max(0, (Number(s.total_amount) || 0) - (Number(s.paid) || 0));
    if (remaining <= 0) continue;
    const title = `Chưa thu đủ tiền: ${s.code}`;
    const body = `${s.customer_name} · còn lại ${remaining.toLocaleString('vi-VN')}đ (đã chụp ${s.shoot_date})`;
    const link = `/buoi-chup?q=${encodeURIComponent(s.code)}`;
    // Nhắc 1 lần/tuần (dedupe theo tuần ISO) để không phiền mỗi ngày.
    const week = isoWeek(t);
    for (const uid of sales) {
      pushNotify(uid, { type: 'payment_due', title, body, link, dedupeKey: `payment_due:${s.id}:${week}:${uid}` });
    }
  }
}

/** Mã tuần ISO dạng YYYY-Www để dedupe theo tuần. */
function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Chạy 1 lượt quét toàn bộ. Lỗi 1 mục không chặn các mục khác. */
export function runReminders(): void {
  try { remindUpcomingShoots(); } catch (e) { console.error('[scheduler] shoots lỗi:', e); }
  try { remindDeliveries(); } catch (e) { console.error('[scheduler] deliveries lỗi:', e); }
  try { remindPaymentDue(); } catch (e) { console.error('[scheduler] payments lỗi:', e); }
}

/** Khởi động scheduler: quét mỗi 6 giờ + 1 lần sau 20 giây khi app vừa chạy. */
export function startScheduler(): void {
  setTimeout(() => runReminders(), 20000);
  setInterval(() => runReminders(), 6 * 60 * 60 * 1000);
}
