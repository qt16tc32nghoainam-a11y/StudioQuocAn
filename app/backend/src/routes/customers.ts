import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist, nextCode } from '../db/database';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);
// Makeup/Photo chỉ được xem (GET); mọi thao tác ghi chỉ Admin.
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.user!.role !== 'Admin') {
    return res.status(403).json({ error: 'Chỉ Admin được thêm/sửa/xóa khách hàng' });
  }
  next();
});

/** GET /api/customers — danh sách khách, có tìm kiếm ?q= */
router.get('/', (req, res) => {
  const q = (req.query.q as string || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = all(
      `SELECT * FROM customers WHERE full_name LIKE ? OR phone LIKE ? OR code LIKE ? ORDER BY created_at DESC`,
      [like, like, like]
    );
  } else {
    rows = all('SELECT * FROM customers ORDER BY created_at DESC');
  }
  res.json(rows);
});

/** GET /api/customers/:id — chi tiết khách kèm buổi chụp (đầy đủ: photo, makeup, đã cọc, giao hình, hạn). */
router.get('/:id', (req, res) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  const shoots = all(
    `SELECT s.*,
            pu.full_name AS photographer_name,
            mu.full_name AS makeup_name,
            d.due_date, d.editing_done, d.delivered, d.delivered_at, d.raw_sent,
            COALESCE((SELECT SUM(so_tien) FROM payments p WHERE p.shoot_id = s.id), 0) AS paid_amount
     FROM shoots s
     LEFT JOIN users pu ON pu.id = s.photographer_id
     LEFT JOIN users mu ON mu.id = s.makeup_id
     LEFT JOIN deliveries d ON d.shoot_id = s.id
     WHERE s.customer_id = ?
     ORDER BY s.shoot_date DESC, s.created_at DESC`,
    [req.params.id]
  );
  res.json({ ...customer, shoots });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHOOT_STATUS = ['Đã đặt lịch', 'Đã chụp', 'Đang xử lý hình', 'Chờ giao', 'Hoàn tất', 'Đã hủy'];

/**
 * POST /api/customers — tạo khách mới. SĐT + Email BẮT BUỘC.
 * Có thể kèm mảng `shoots` (buổi chụp khách book cùng lúc): mỗi phần tử { shoot_type, shoot_date, start_time?, end_time? }.
 * Mỗi buổi chụp tạo kèm 1 bản ghi giao hình.
 */
router.post('/', (req, res) => {
  const { full_name, phone, email, address, source, note, shoots } = req.body || {};
  if (!full_name || !String(full_name).trim()) return res.status(400).json({ error: 'Thiếu tên khách hàng' });
  if (!phone || !String(phone).trim()) return res.status(400).json({ error: 'Vui lòng nhập số điện thoại khách hàng' });
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: 'Vui lòng nhập email khách hàng hợp lệ (dùng để gửi mail hợp đồng và giao ảnh)' });
  }
  // Validate các buổi chụp (nếu có)
  const list: any[] = Array.isArray(shoots) ? shoots : [];
  for (const s of list) {
    if (!s || !s.shoot_type) return res.status(400).json({ error: 'Mỗi buổi chụp phải chọn loại chụp' });
    if (s.status && !SHOOT_STATUS.includes(s.status)) return res.status(400).json({ error: 'Trạng thái buổi chụp không hợp lệ' });
  }

  const now = new Date().toISOString();
  const id = uuid();
  run(
    `INSERT INTO customers (id, code, full_name, phone, email, address, source, note, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, nextCode('customers', 'KH'), String(full_name).trim(), String(phone).trim(), String(email).trim(), address || null, source || null, note || null, req.user!.id, now, now]
  );

  const createdShoots: string[] = [];
  for (const s of list) {
    const sid = uuid();
    run(
      `INSERT INTO shoots (id, code, customer_id, title, shoot_type, shoot_date, start_time, end_time, status, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [sid, nextCode('shoots', 'BC'), id, null, s.shoot_type, s.shoot_date || null, s.start_time || null, s.end_time || null, 'Đã đặt lịch', req.user!.id, now, now]
    );
    run(
      `INSERT INTO deliveries (id, shoot_id, editing_done, delivered, raw_sent, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [uuid(), sid, 0, 0, 0, now, now]
    );
    createdShoots.push(sid);
  }
  persist();
  res.status(201).json({ id, shoots: createdShoots });
});

/** PUT /api/customers/:id — cập nhật khách. */
router.put('/:id', (req, res) => {
  const c = get<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  const { full_name, phone, email, address, source, note } = req.body || {};
  // Email + SĐT vẫn bắt buộc hợp lệ nếu được gửi lên (không cho xóa trống).
  if (email !== undefined && (!email || !EMAIL_RE.test(String(email).trim()))) {
    return res.status(400).json({ error: 'Email khách hàng không hợp lệ' });
  }
  if (phone !== undefined && !String(phone).trim()) {
    return res.status(400).json({ error: 'Số điện thoại không được để trống' });
  }
  run(
    `UPDATE customers SET full_name = ?, phone = ?, email = ?, address = ?, source = ?, note = ?, updated_at = ? WHERE id = ?`,
    [full_name ?? c.full_name, phone ?? c.phone, email !== undefined ? String(email).trim() : c.email, address ?? c.address, source ?? c.source, note ?? c.note, new Date().toISOString(), req.params.id]
  );
  persist();
  res.json({ ok: true });
});

/** DELETE /api/customers/:id — xóa khách (chặn nếu còn buổi chụp). */
router.delete('/:id', (req, res) => {
  const c = get<{ id: string }>('SELECT id FROM customers WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  const has = get<{ n: number }>('SELECT COUNT(*) AS n FROM shoots WHERE customer_id = ?', [req.params.id]);
  if (has && has.n > 0) return res.status(400).json({ error: 'Khách còn buổi chụp, hãy xóa buổi chụp trước' });
  run('DELETE FROM customers WHERE id = ?', [req.params.id]);
  persist();
  res.json({ ok: true });
});

export default router;
