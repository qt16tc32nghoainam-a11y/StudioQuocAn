import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist } from '../db/database';
import { authenticate } from '../middleware/auth';
import { shootScope } from '../utils/scope';
import { enqueuePhotosDelivered, enqueueRawPhotos, enqueuePromisedDate } from '../notifications';
import { config } from '../config';
import { AuthUser } from '../types';

const router = Router();
router.use(authenticate);

/** Nhân viên chỉ được thao tác giao hình của buổi chụp mình phụ trách. Trả true nếu được phép. */
function canAccessShoot(user: AuthUser, shoot: { photographer_id?: string | null; makeup_id?: string | null }): boolean {
  if (user.role === 'Admin') return true;
  if (user.role === 'Photo') return shoot.photographer_id === user.id;
  if (user.role === 'Makeup') return shoot.makeup_id === user.id;
  return false;
}

/**
 * GET /api/deliveries — bảng theo dõi giao hình (kèm tên khách, ngày chụp).
 * Lọc: ?pending=1 (chưa giao xong), ?editing=0 (chưa làm hình), ?overdue=1 (quá hạn chưa giao)
 */
router.get('/', (req, res) => {
  const { pending, editing, overdue } = req.query as Record<string, string>;
  const where: string[] = [];
  const params: any[] = [];
  if (pending === '1') where.push('d.delivered = 0');
  if (editing === '0') where.push('d.editing_done = 0');
  if (editing === '1') where.push('d.editing_done = 1');
  // Quá hạn = chưa giao & đã qua mốc giao (ưu tiên ngày hẹn giao khách promised_date, không có thì dùng hạn nội bộ due_date).
  if (overdue === '1') { where.push("d.delivered = 0 AND COALESCE(d.promised_date, d.due_date) IS NOT NULL AND COALESCE(d.promised_date, d.due_date) < ?"); params.push(new Date().toISOString().slice(0, 10)); }
  // Phân quyền: nhân viên chỉ thấy giao hình của buổi mình phụ trách.
  const scope = shootScope(req.user!, 's');
  if (scope.clause) { where.push(scope.clause); params.push(...scope.params); }
  const sql = `
    SELECT d.*, s.code AS shoot_code, s.title AS shoot_title, s.shoot_type, s.shoot_date, s.status AS shoot_status,
           c.full_name AS customer_name, c.phone AS customer_phone
    FROM deliveries d
    JOIN shoots s ON s.id = d.shoot_id
    JOIN customers c ON c.id = s.customer_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY (d.due_date IS NULL), d.due_date ASC`;
  res.json(all(sql, params));
});

/** GET /api/deliveries/:id */
router.get('/:id', (req, res) => {
  const d = get<any>('SELECT * FROM deliveries WHERE id = ?', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'Không tìm thấy bản ghi giao hình' });
  const shoot = get<any>('SELECT photographer_id, makeup_id FROM shoots WHERE id = ?', [d.shoot_id]);
  if (!shoot || !canAccessShoot(req.user!, shoot)) return res.status(403).json({ error: 'Không có quyền xem giao hình của buổi này' });
  res.json(d);
});

/**
 * PUT /api/deliveries/:id — cập nhật tiến độ giao hình.
 * Khi bật editing_done / delivered mà chưa có mốc thời gian thì tự điền thời điểm hiện tại.
 */
router.put('/:id', (req, res) => {
  const d = get<any>('SELECT * FROM deliveries WHERE id = ?', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'Không tìm thấy bản ghi giao hình' });
  const shoot = get<any>('SELECT photographer_id, makeup_id FROM shoots WHERE id = ?', [d.shoot_id]);
  if (!shoot || !canAccessShoot(req.user!, shoot)) return res.status(403).json({ error: 'Không có quyền cập nhật giao hình của buổi này' });
  const b = req.body || {};
  const now = new Date().toISOString();

  const editingDone = b.editing_done !== undefined ? (b.editing_done ? 1 : 0) : d.editing_done;
  const delivered = b.delivered !== undefined ? (b.delivered ? 1 : 0) : d.delivered;
  const rawSent = b.raw_sent !== undefined ? (b.raw_sent ? 1 : 0) : d.raw_sent;

  // Tự điền mốc thời gian khi trạng thái chuyển sang xong (và xóa khi bỏ tick).
  let editingDoneAt = d.editing_done_at;
  if (editingDone && !d.editing_done) editingDoneAt = b.editing_done_at || now;
  if (!editingDone) editingDoneAt = null;

  let deliveredAt = d.delivered_at;
  if (delivered && !d.delivered) deliveredAt = b.delivered_at || now;
  if (!delivered) deliveredAt = null;

  let rawSentAt = d.raw_sent_at;
  if (rawSent && !d.raw_sent) rawSentAt = now;
  if (!rawSent) rawSentAt = null;

  const promisedDate = b.promised_date !== undefined ? (b.promised_date || null) : d.promised_date;
  // Có cần báo khách ngày hẹn giao không? (vừa đặt / vừa đổi so với lần đã báo gần nhất)
  const notifyPromised = !!promisedDate && promisedDate !== d.promised_notified_date;
  const promisedNotifiedDate = notifyPromised ? promisedDate : d.promised_notified_date;

  run(
    `UPDATE deliveries SET due_date=?, promised_date=?, promised_notified_date=?, editor_id=?, raw_link=?, raw_sent=?, raw_sent_at=?,
       editing_done=?, editing_done_at=?, delivered=?, delivered_at=?,
       delivery_method=?, delivery_link=?, photo_count=?, note=?, updated_at=? WHERE id=?`,
    [
      b.due_date ?? d.due_date, promisedDate, promisedNotifiedDate, b.editor_id ?? d.editor_id,
      b.raw_link !== undefined ? b.raw_link : d.raw_link, rawSent, rawSentAt,
      editingDone, editingDoneAt, delivered, deliveredAt,
      b.delivery_method ?? d.delivery_method, b.delivery_link ?? d.delivery_link,
      b.photo_count ?? d.photo_count, b.note ?? d.note, now, req.params.id,
    ]
  );

  // Đồng bộ trạng thái buổi chụp theo tiến độ giao hình (tiện lợi, không bắt buộc).
  if (delivered) {
    run("UPDATE shoots SET status = 'Hoàn tất', updated_at = ? WHERE id = ? AND status != 'Đã hủy'", [now, d.shoot_id]);
  } else if (editingDone) {
    run("UPDATE shoots SET status = 'Chờ giao', updated_at = ? WHERE id = ? AND status IN ('Đã chụp','Đang xử lý hình','Đã đặt lịch')", [now, d.shoot_id]);
  }

  persist();

  const finalLink = b.delivery_link ?? d.delivery_link;
  const finalMethod = b.delivery_method ?? d.delivery_method;
  const finalRawLink = b.raw_link !== undefined ? b.raw_link : d.raw_link;
  const needInfo = (rawSent && !d.raw_sent) || (delivered && !d.delivered) || notifyPromised;
  const info = needInfo ? get<any>(
    `SELECT s.code, s.shoot_type, s.shoot_date, c.full_name AS customer_name, c.email AS customer_email
     FROM shoots s JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`, [d.shoot_id]) : null;

  // Studio đặt/đổi NGÀY HẸN GIAO -> email báo khách (dedupe theo ngày hẹn, mỗi ngày hẹn báo 1 lần).
  if (notifyPromised && info?.customer_email) {
    enqueuePromisedDate(info.customer_email, info.customer_name, info, promisedDate, config.appName, promisedDate);
  }
  // Bước 1: vừa gửi ẢNH GỐC để khách lựa -> email mời chọn ảnh.
  if (rawSent && !d.raw_sent && info?.customer_email) {
    enqueueRawPhotos(info.customer_email, info.customer_name, info, finalRawLink || '', config.appName, d.shoot_id + ':raw');
  }
  // Bước 2: vừa GIAO ảnh hoàn thiện -> email ảnh đã sẵn sàng.
  if (delivered && !d.delivered && info?.customer_email) {
    enqueuePhotosDelivered(info.customer_email, info.customer_name, info, finalLink || '', finalMethod || '', config.appName, d.shoot_id + ':final');
  }

  res.json({ ok: true });
});

export default router;
