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

/** GET /api/customers/:id — chi tiết khách kèm các buổi chụp. */
router.get('/:id', (req, res) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  const shoots = all('SELECT * FROM shoots WHERE customer_id = ? ORDER BY shoot_date DESC', [req.params.id]);
  res.json({ ...customer, shoots });
});

/** POST /api/customers — tạo khách mới. */
router.post('/', (req, res) => {
  const { full_name, phone, email, address, source, note } = req.body || {};
  if (!full_name) return res.status(400).json({ error: 'Thiếu tên khách hàng' });
  const now = new Date().toISOString();
  const id = uuid();
  run(
    `INSERT INTO customers (id, code, full_name, phone, email, address, source, note, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, nextCode('customers', 'KH'), full_name, phone || null, email || null, address || null, source || null, note || null, req.user!.id, now, now]
  );
  persist();
  res.status(201).json({ id });
});

/** PUT /api/customers/:id — cập nhật khách. */
router.put('/:id', (req, res) => {
  const c = get<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  const { full_name, phone, email, address, source, note } = req.body || {};
  run(
    `UPDATE customers SET full_name = ?, phone = ?, email = ?, address = ?, source = ?, note = ?, updated_at = ? WHERE id = ?`,
    [full_name ?? c.full_name, phone ?? c.phone, email ?? c.email, address ?? c.address, source ?? c.source, note ?? c.note, new Date().toISOString(), req.params.id]
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
