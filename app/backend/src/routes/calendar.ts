import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist } from '../db/database';
import { authenticate } from '../middleware/auth';
import { shootScope } from '../utils/scope';
import { config } from '../config';
import { AuthUser } from '../types';

const router = Router();

// ============ ICS FEED (KHÔNG cần đăng nhập — xác thực bằng token trong URL) ============
// Đặt TRƯỚC middleware authenticate để Google fetch được.
// GET /api/calendar/feed/:token.ics

function pad(n: number) { return String(n).padStart(2, '0'); }

/** Chuyển 'YYYY-MM-DD' + 'HH:mm' sang chuỗi ICS. Không có giờ -> sự kiện cả ngày. */
function icsDates(date: string, start?: string, end?: string): string {
  const d = (date || '').slice(0, 10).replace(/-/g, '');
  if (!d) return '';
  if (start) {
    const st = start.replace(':', '') + '00';
    const et = (end || start).replace(':', '') + '00';
    // Thời gian local (floating) — hiển thị đúng giờ VN trên lịch người xem.
    return `DTSTART:${d}T${st}\r\nDTEND:${d}T${et}`;
  }
  // cả ngày
  const next = new Date(Date.parse(date.slice(0, 10)) + 86400000);
  const nd = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
  return `DTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${nd}`;
}

function esc(s: any): string {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

router.get('/feed/:token.ics', (req, res) => {
  const token = req.params.token;
  if (!token) return res.status(404).send('Not found');
  const user = get<any>('SELECT id, full_name, role FROM users WHERE calendar_token = ?', [token]);
  if (!user) return res.status(404).send('Not found');

  const authUser = { id: user.id, role: user.role } as AuthUser;
  const scope = shootScope(authUser, 's');
  const where = ["s.status != 'Đã hủy'"];
  const params: any[] = [];
  if (scope.clause) { where.push(scope.clause); params.push(...scope.params); }

  const rows = all<any>(
    `SELECT s.id, s.code, s.shoot_type, s.shoot_date, s.start_time, s.end_time, s.location, s.status,
            c.full_name AS customer_name,
            pu.full_name AS photographer_name, mu.full_name AS makeup_name
     FROM shoots s
     JOIN customers c ON c.id = s.customer_id
     LEFT JOIN users pu ON pu.id = s.photographer_id
     LEFT JOIN users mu ON mu.id = s.makeup_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.shoot_date ASC`,
    params
  );

  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${config.appName}//Lich chup//VI`,
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(config.appName)} - Lịch chụp`,
  ];
  for (const r of rows) {
    if (!r.shoot_date) continue;
    const dt = icsDates(r.shoot_date, r.start_time, r.end_time);
    if (!dt) continue;
    const title = `${r.customer_name}${r.shoot_type ? ' - ' + r.shoot_type : ''}`;
    const descParts = [
      `Mã: ${r.code}`,
      r.photographer_name ? `Chụp: ${r.photographer_name}` : '',
      r.makeup_name ? `Makeup: ${r.makeup_name}` : '',
      `Trạng thái: ${r.status}`,
    ].filter(Boolean);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.id}@studioquocan`,
      `DTSTAMP:${stamp}`,
      dt,
      `SUMMARY:${esc(title)}`,
      r.location ? `LOCATION:${esc(r.location)}` : '',
      `DESCRIPTION:${esc(descParts.join(' | '))}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  const body = lines.filter(Boolean).join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="lich-chup.ics"');
  res.send(body);
});

// ============ Các endpoint cần đăng nhập ============
router.use(authenticate);

/**
 * GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — lịch làm việc theo khoảng ngày.
 * Admin xem tất cả; Photo/Makeup chỉ xem buổi chụp mình được gán. KHÔNG trả thông tin tiền.
 * Admin có thể lọc theo 1 nhân viên: ?staff_id=
 */
router.get('/', (req, res) => {
  const { from, to, staff_id } = req.query as Record<string, string>;
  const where: string[] = [];
  const params: any[] = [];

  if (from) { where.push('s.shoot_date >= ?'); params.push(from); }
  if (to) { where.push('s.shoot_date <= ?'); params.push(to); }

  const scope = shootScope(req.user!, 's');
  if (scope.clause) { where.push(scope.clause); params.push(...scope.params); }

  if (staff_id && req.user!.role === 'Admin') {
    where.push('(s.photographer_id = ? OR s.makeup_id = ?)');
    params.push(staff_id, staff_id);
  }

  const sql = `
    SELECT s.id, s.code, s.title, s.shoot_type, s.shoot_date, s.start_time, s.end_time,
           s.location, s.status, s.photographer_id, s.makeup_id,
           c.full_name AS customer_name, c.phone AS customer_phone,
           pu.full_name AS photographer_name, mu.full_name AS makeup_name
    FROM shoots s
    JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users pu ON pu.id = s.photographer_id
    LEFT JOIN users mu ON mu.id = s.makeup_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.shoot_date ASC, s.start_time ASC`;
  res.json(all(sql, params));
});

/** GET /api/calendar/my-feed-url — link ICS của chính mình (tự tạo token nếu chưa có). */
router.get('/my-feed-url', (req, res) => {
  let u = get<any>('SELECT calendar_token FROM users WHERE id = ?', [req.user!.id]);
  let token = u?.calendar_token;
  if (!token) {
    token = uuid().replace(/-/g, '') + uuid().replace(/-/g, '');
    run('UPDATE users SET calendar_token = ? WHERE id = ?', [token, req.user!.id]);
    persist();
  }
  res.json({ url: `/api/calendar/feed/${token}.ics` });
});

/** POST /api/calendar/reset-token — đổi token (thu hồi link cũ). */
router.post('/reset-token', (req, res) => {
  const token = uuid().replace(/-/g, '') + uuid().replace(/-/g, '');
  run('UPDATE users SET calendar_token = ? WHERE id = ?', [token, req.user!.id]);
  persist();
  res.json({ url: `/api/calendar/feed/${token}.ics` });
});

export default router;
