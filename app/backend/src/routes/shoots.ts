import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist, nextCode } from '../db/database';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const SHOOT_STATUS = ['Đã đặt lịch', 'Đã chụp', 'Đang xử lý hình', 'Chờ giao', 'Hoàn tất', 'Đã hủy'];

/**
 * GET /api/shoots — danh sách buổi chụp (kèm tên khách + tình trạng giao hình).
 * Lọc: ?status= , ?from= , ?to= (theo shoot_date), ?q= (tên khách / mã)
 */
router.get('/', (req, res) => {
  const { status, from, to, q } = req.query as Record<string, string>;
  const where: string[] = [];
  const params: any[] = [];
  if (status) { where.push('s.status = ?'); params.push(status); }
  if (from) { where.push('s.shoot_date >= ?'); params.push(from); }
  if (to) { where.push('s.shoot_date <= ?'); params.push(to); }
  if (q) { where.push('(c.full_name LIKE ? OR s.code LIKE ? OR s.title LIKE ?)'); const l = `%${q}%`; params.push(l, l, l); }
  const sql = `
    SELECT s.*, c.full_name AS customer_name, c.phone AS customer_phone,
           d.id AS delivery_id, d.due_date, d.editing_done, d.delivered, d.delivered_at
    FROM shoots s
    JOIN customers c ON c.id = s.customer_id
    LEFT JOIN deliveries d ON d.shoot_id = s.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.shoot_date DESC, s.created_at DESC`;
  res.json(all(sql, params));
});

/** GET /api/shoots/:id — chi tiết buổi chụp kèm khách + giao hình. */
router.get('/:id', (req, res) => {
  const shoot = get<any>('SELECT * FROM shoots WHERE id = ?', [req.params.id]);
  if (!shoot) return res.status(404).json({ error: 'Không tìm thấy buổi chụp' });
  const customer = get('SELECT * FROM customers WHERE id = ?', [shoot.customer_id]);
  const delivery = get('SELECT * FROM deliveries WHERE shoot_id = ?', [req.params.id]);
  res.json({ ...shoot, customer, delivery });
});

/** POST /api/shoots — tạo buổi chụp (tự tạo bản ghi giao hình đi kèm). */
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.customer_id) return res.status(400).json({ error: 'Thiếu khách hàng' });
  const customer = get<{ id: string }>('SELECT id FROM customers WHERE id = ?', [b.customer_id]);
  if (!customer) return res.status(400).json({ error: 'Khách hàng không tồn tại' });
  if (b.status && !SHOOT_STATUS.includes(b.status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const now = new Date().toISOString();
  const id = uuid();
  run(
    `INSERT INTO shoots (id, code, customer_id, title, package_name, shoot_type, location, shoot_date,
       photographer_id, makeup_id, total_amount, deposit_amount, paid_full, status, note, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, nextCode('shoots', 'BC'), b.customer_id, b.title || null, b.package_name || null, b.shoot_type || null,
     b.location || null, b.shoot_date || null, b.photographer_id || null, b.makeup_id || null,
     Number(b.total_amount) || 0, Number(b.deposit_amount) || 0, b.paid_full ? 1 : 0, b.status || 'Đã đặt lịch',
     b.note || null, req.user!.id, now, now]
  );
  // Tạo bản ghi giao hình gắn liền
  run(
    `INSERT INTO deliveries (id, shoot_id, due_date, editing_done, delivered, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [uuid(), id, b.due_date || null, 0, 0, now, now]
  );
  persist();
  res.status(201).json({ id });
});

/** PUT /api/shoots/:id — cập nhật buổi chụp. */
router.put('/:id', (req, res) => {
  const s = get<any>('SELECT * FROM shoots WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Không tìm thấy buổi chụp' });
  const b = req.body || {};
  if (b.status && !SHOOT_STATUS.includes(b.status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  run(
    `UPDATE shoots SET title=?, package_name=?, shoot_type=?, location=?, shoot_date=?,
       photographer_id=?, makeup_id=?, total_amount=?, deposit_amount=?, paid_full=?, status=?, note=?, updated_at=?
     WHERE id=?`,
    [
      b.title ?? s.title, b.package_name ?? s.package_name, b.shoot_type ?? s.shoot_type, b.location ?? s.location,
      b.shoot_date ?? s.shoot_date, b.photographer_id ?? s.photographer_id, b.makeup_id ?? s.makeup_id,
      b.total_amount ?? s.total_amount, b.deposit_amount ?? s.deposit_amount,
      b.paid_full !== undefined ? (b.paid_full ? 1 : 0) : s.paid_full,
      b.status ?? s.status, b.note ?? s.note, new Date().toISOString(), req.params.id,
    ]
  );
  persist();
  res.json({ ok: true });
});

/** DELETE /api/shoots/:id — xóa buổi chụp + giao hình liên quan. */
router.delete('/:id', (req, res) => {
  const s = get<{ id: string }>('SELECT id FROM shoots WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Không tìm thấy buổi chụp' });
  run('DELETE FROM deliveries WHERE shoot_id = ?', [req.params.id]);
  run('DELETE FROM shoots WHERE id = ?', [req.params.id]);
  persist();
  res.json({ ok: true });
});

export default router;
