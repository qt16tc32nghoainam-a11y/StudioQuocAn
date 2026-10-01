import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist } from '../db/database';
import { authenticate } from '../middleware/auth';
import { enqueuePhotosDelivered } from '../notifications';
import { config } from '../config';

const router = Router();
router.use(authenticate);

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
  if (overdue === '1') { where.push("d.delivered = 0 AND d.due_date IS NOT NULL AND d.due_date < ?"); params.push(new Date().toISOString().slice(0, 10)); }
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
  const d = get('SELECT * FROM deliveries WHERE id = ?', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'Không tìm thấy bản ghi giao hình' });
  res.json(d);
});

/**
 * PUT /api/deliveries/:id — cập nhật tiến độ giao hình.
 * Khi bật editing_done / delivered mà chưa có mốc thời gian thì tự điền thời điểm hiện tại.
 */
router.put('/:id', (req, res) => {
  const d = get<any>('SELECT * FROM deliveries WHERE id = ?', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'Không tìm thấy bản ghi giao hình' });
  const b = req.body || {};
  const now = new Date().toISOString();

  const editingDone = b.editing_done !== undefined ? (b.editing_done ? 1 : 0) : d.editing_done;
  const delivered = b.delivered !== undefined ? (b.delivered ? 1 : 0) : d.delivered;

  // Tự điền mốc thời gian khi trạng thái chuyển sang xong (và xóa khi bỏ tick).
  let editingDoneAt = d.editing_done_at;
  if (editingDone && !d.editing_done) editingDoneAt = b.editing_done_at || now;
  if (!editingDone) editingDoneAt = null;

  let deliveredAt = d.delivered_at;
  if (delivered && !d.delivered) deliveredAt = b.delivered_at || now;
  if (!delivered) deliveredAt = null;

  run(
    `UPDATE deliveries SET due_date=?, editor_id=?, editing_done=?, editing_done_at=?, delivered=?, delivered_at=?,
       delivery_method=?, delivery_link=?, photo_count=?, note=?, updated_at=? WHERE id=?`,
    [
      b.due_date ?? d.due_date, b.editor_id ?? d.editor_id, editingDone, editingDoneAt, delivered, deliveredAt,
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

  // Vừa chuyển sang ĐÃ GIAO -> gửi email link ảnh cho khách.
  const finalLink = b.delivery_link ?? d.delivery_link;
  const finalMethod = b.delivery_method ?? d.delivery_method;
  if (delivered && !d.delivered) {
    const info = get<any>(
      `SELECT s.code, s.shoot_type, s.shoot_date, c.full_name AS customer_name, c.email AS customer_email
       FROM shoots s JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`, [d.shoot_id]);
    if (info?.customer_email) {
      enqueuePhotosDelivered(info.customer_email, info.customer_name, info, finalLink || '', finalMethod || '', config.appName, d.shoot_id);
    }
  }

  res.json({ ok: true });
});

export default router;
