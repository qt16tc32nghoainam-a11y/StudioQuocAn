import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist, nextCode } from '../db/database';
import { authenticate } from '../middleware/auth';
import { shootScope } from '../utils/scope';
import { enqueueBookingConfirmed } from '../notifications';
import { config } from '../config';
import { AuthUser } from '../types';

const router = Router();
router.use(authenticate);

/** Nhân viên chỉ thấy khách có ít nhất 1 buổi chụp mình phụ trách. */
function canAccessCustomer(user: AuthUser, customerId: string): boolean {
  if (user.role === 'Admin') return true;
  const scope = shootScope(user, 's');
  if (!scope.clause) return true;
  const row = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM shoots s WHERE s.customer_id = ? AND ${scope.clause}`,
    [customerId, ...scope.params]
  );
  return !!row && row.n > 0;
}
// Makeup/Photo chỉ được xem (GET); mọi thao tác ghi chỉ Admin.
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.user!.role !== 'Admin') {
    return res.status(403).json({ error: 'Chỉ Admin được thêm/sửa/xóa khách hàng' });
  }
  next();
});

/** GET /api/customers — danh sách khách, có tìm kiếm ?q=. Nhân viên chỉ thấy khách của buổi mình phụ trách. */
router.get('/', (req, res) => {
  const q = (req.query.q as string || '').trim();
  const where: string[] = [];
  const params: any[] = [];
  if (q) {
    const like = `%${q}%`;
    where.push('(c.full_name LIKE ? OR c.phone LIKE ? OR c.code LIKE ?)');
    params.push(like, like, like);
  }
  // Phân quyền: non-Admin chỉ lấy khách có buổi chụp mình phụ trách.
  const scope = shootScope(req.user!, 's');
  if (scope.clause) {
    where.push(`c.id IN (SELECT s.customer_id FROM shoots s WHERE ${scope.clause})`);
    params.push(...scope.params);
  }
  const sql = `SELECT c.* FROM customers c ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.created_at DESC`;
  res.json(all(sql, params));
});

/** GET /api/customers/:id — chi tiết khách kèm buổi chụp (đầy đủ: photo, makeup, đã cọc, giao hình, hạn). */
router.get('/:id', (req, res) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  if (!canAccessCustomer(req.user!, req.params.id)) return res.status(403).json({ error: 'Không có quyền xem khách hàng này' });
  const isAdmin = req.user!.role === 'Admin';
  const scope = shootScope(req.user!, 's');
  const scopeClause = scope.clause ? ` AND ${scope.clause}` : '';
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
     WHERE s.customer_id = ?${scopeClause}
     ORDER BY s.shoot_date DESC, s.created_at DESC`,
    [req.params.id, ...scope.params]
  ).map((s: any) => {
    if (isAdmin) return s;
    const { total_amount, deposit_amount, paid_full, paid_amount, ...rest } = s;
    return rest;
  });
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
  const mailShoots: { code: string; shoot_type?: string; shoot_date?: string }[] = [];
  for (const s of list) {
    const sid = uuid();
    const code = nextCode('shoots', 'BC');
    run(
      `INSERT INTO shoots (id, code, customer_id, title, shoot_type, shoot_date, start_time, end_time, status, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [sid, code, id, null, s.shoot_type, s.shoot_date || null, s.start_time || null, s.end_time || null, s.status || 'Đã đặt lịch', req.user!.id, now, now]
    );
    run(
      `INSERT INTO deliveries (id, shoot_id, editing_done, delivered, raw_sent, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [uuid(), sid, 0, 0, 0, now, now]
    );
    createdShoots.push(sid);
    // Chỉ xác nhận các buổi chưa hủy.
    if ((s.status || 'Đã đặt lịch') !== 'Đã hủy') {
      mailShoots.push({ code, shoot_type: s.shoot_type, shoot_date: s.shoot_date || undefined, customer_name: String(full_name).trim() } as any);
    }
  }
  persist();

  // Email xác nhận chốt lịch gửi khách (gộp tất cả buổi vừa book trong 1 mail).
  if (mailShoots.length) {
    enqueueBookingConfirmed(String(email).trim(), String(full_name).trim(), mailShoots, config.appName, id);
  }
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
