import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist, nextCode } from '../db/database';
import { authenticate } from '../middleware/auth';
import { shootScope, isSale } from '../utils/scope';
import { enqueueShootMail, enqueueBookingConfirmed, enqueueBookingCancelled, ShootMailInfo } from '../notifications';
import { config } from '../config';

const router = Router();
router.use(authenticate);
// Photo chỉ được xem (GET); Sale (Admin/Makeup) được thêm/sửa/xóa buổi chụp.
router.use((req, res, next) => {
  if (req.method !== 'GET' && !isSale(req.user!.role)) {
    return res.status(403).json({ error: 'Chỉ Admin hoặc nhân viên tư vấn (Makeup) được thêm/sửa/xóa buổi chụp' });
  }
  next();
});

const SHOOT_STATUS = ['Đã đặt lịch', 'Đã chụp', 'Đang xử lý hình', 'Chờ giao', 'Hoàn tất', 'Đã hủy'];

/** Ẩn các trường tiền với Photo (chỉ Sale = Admin/Makeup thấy tổng tiền/cọc/đã thu). */
function stripMoney(user: { role: string }, row: any): any {
  if (!row || isSale(user.role)) return row;
  const { total_amount, deposit_amount, paid_full, ...rest } = row;
  return rest;
}

/** Chuỗi rỗng -> null (tránh ghi '' vào khóa ngoại). */
function nn(v: any): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Kiểm tra 1 user có đúng role + đang hoạt động không. Trả thông tin user hoặc null. */
function checkAssignee(userId: string | null, role: 'Photo' | 'Makeup'): { ok: boolean; user?: any; error?: string } {
  if (!userId) return { ok: true };
  const u = get<any>('SELECT id, full_name, email, role, status FROM users WHERE id = ?', [userId]);
  if (!u) return { ok: false, error: 'Nhân viên được gán không tồn tại' };
  if (u.status !== 'Hoạt động') return { ok: false, error: `Nhân viên ${u.full_name} đang bị tạm khóa` };
  if (u.role !== role) return { ok: false, error: `${u.full_name} không phải nhân viên ${role === 'Photo' ? 'Photo' : 'Makeup'}` };
  return { ok: true, user: u };
}

function userById(id: string | null): any | null {
  if (!id) return null;
  return get<any>('SELECT id, full_name, email, role FROM users WHERE id = ?', [id]) || null;
}

/** Gom thông tin buổi chụp để đưa vào email. */
function mailInfo(shootId: string): ShootMailInfo {
  const r = get<any>(
    `SELECT s.code, s.shoot_type, s.shoot_date, s.start_time, s.end_time, s.location, s.title, s.status,
            c.full_name AS customer_name
     FROM shoots s JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`, [shootId]);
  return r || {};
}

const ROLE_LABEL = { Photo: 'Người chụp', Makeup: 'Trang điểm' } as const;

/** Các trường quan trọng về lịch — đổi thì báo cho người đang phụ trách. */
function scheduleChanged(a: any, b: any): boolean {
  return ['shoot_date', 'start_time', 'end_time', 'location', 'shoot_type', 'title'].some((k) => (a[k] || '') !== (b[k] || ''));
}

/** GET /api/shoots — danh sách (Admin xem hết, nhân viên chỉ buổi được gán). */
router.get('/', (req, res) => {
  const { status, from, to, q } = req.query as Record<string, string>;
  const where: string[] = [];
  const params: any[] = [];
  if (status) { where.push('s.status = ?'); params.push(status); }
  if (from) { where.push('s.shoot_date >= ?'); params.push(from); }
  if (to) { where.push('s.shoot_date <= ?'); params.push(to); }
  if (q) { where.push('(c.full_name LIKE ? OR s.code LIKE ? OR s.title LIKE ?)'); const l = `%${q}%`; params.push(l, l, l); }
  // Sale (Admin/Makeup) xem mọi buổi; Photo chỉ buổi mình chụp.
  const scope = isSale(req.user!.role) ? { clause: '', params: [] as any[] } : shootScope(req.user!, 's');
  if (scope.clause) { where.push(scope.clause); params.push(...scope.params); }
  const sql = `
    SELECT s.*, c.full_name AS customer_name, c.phone AS customer_phone,
           d.id AS delivery_id, d.due_date, d.editing_done, d.delivered, d.delivered_at
    FROM shoots s
    JOIN customers c ON c.id = s.customer_id
    LEFT JOIN deliveries d ON d.shoot_id = s.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.shoot_date DESC, s.created_at DESC`;
  res.json(all(sql, params).map((r: any) => stripMoney(req.user!, r)));
});

/** GET /api/shoots/:id — chi tiết (nhân viên chỉ xem buổi mình được gán). */
router.get('/:id', (req, res) => {
  const shoot = get<any>('SELECT * FROM shoots WHERE id = ?', [req.params.id]);
  if (!shoot) return res.status(404).json({ error: 'Không tìm thấy buổi chụp' });
  // Photo chỉ xem buổi mình chụp; Sale (Admin/Makeup) xem mọi buổi.
  if (!isSale(req.user!.role) && req.user!.role === 'Photo' && shoot.photographer_id !== req.user!.id) {
    return res.status(403).json({ error: 'Không có quyền xem buổi chụp này' });
  }
  const customer = get('SELECT * FROM customers WHERE id = ?', [shoot.customer_id]);
  const delivery = get('SELECT * FROM deliveries WHERE shoot_id = ?', [req.params.id]);
  res.json({ ...stripMoney(req.user!, shoot), customer, delivery });
});

/** POST /api/shoots — tạo buổi chụp + bản ghi giao hình + email phân công. */
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.customer_id) return res.status(400).json({ error: 'Thiếu khách hàng' });
  const customer = get<{ id: string }>('SELECT id FROM customers WHERE id = ?', [b.customer_id]);
  if (!customer) return res.status(400).json({ error: 'Khách hàng không tồn tại' });
  if (b.status && !SHOOT_STATUS.includes(b.status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const photographerId = nn(b.photographer_id);
  const makeupId = nn(b.makeup_id);
  const cp = checkAssignee(photographerId, 'Photo'); if (!cp.ok) return res.status(400).json({ error: cp.error });
  const cm = checkAssignee(makeupId, 'Makeup'); if (!cm.ok) return res.status(400).json({ error: cm.error });

  const now = new Date().toISOString();
  const id = uuid();
  const total = Number(b.total_amount) || 0;
  const initialDeposit = Number(b.deposit_amount) || 0; // cọc nhập nhanh lúc tạo -> ghi thành 1 khoản thu
  // deposit_amount & paid_full KHÔNG set thủ công: luôn tính từ bảng payments (nguồn tiền duy nhất).
  run(
    `INSERT INTO shoots (id, code, customer_id, title, package_name, shoot_type, location, shoot_date, start_time, end_time,
       photographer_id, makeup_id, total_amount, deposit_amount, paid_full, status, note, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, nextCode('shoots', 'BC'), b.customer_id, nn(b.title), nn(b.package_name), nn(b.shoot_type),
     nn(b.location), nn(b.shoot_date), nn(b.start_time), nn(b.end_time), photographerId, makeupId,
     total, 0, 0, b.status || 'Đã đặt lịch',
     nn(b.note), req.user!.id, now, now]
  );
  run(
    `INSERT INTO deliveries (id, shoot_id, due_date, editing_done, delivered, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [uuid(), id, nn(b.due_date), 0, 0, now, now]
  );
  // Nếu Admin nhập sẵn tiền cọc lúc tạo buổi -> tạo 1 khoản thu "Đặt cọc" để tiền có nguồn gốc rõ ràng.
  if (initialDeposit > 0) {
    run(
      `INSERT INTO payments (id, shoot_id, ngay, so_tien, loai, note, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uuid(), id, now.slice(0, 10), initialDeposit, 'Đặt cọc', 'Cọc ghi khi tạo buổi', req.user!.id, now]
    );
    // Đồng bộ deposit_amount/paid_full theo tổng payments.
    const paidFull = total > 0 && initialDeposit >= total ? 1 : 0;
    run('UPDATE shoots SET deposit_amount = ?, paid_full = ? WHERE id = ?', [initialDeposit, paidFull, id]);
  }
  persist();

  // Email phân công (nếu buổi chụp chưa hủy)
  if ((b.status || 'Đã đặt lịch') !== 'Đã hủy') {
    const info = mailInfo(id);
    if (cp.user) enqueueShootMail('assigned', cp.user, ROLE_LABEL.Photo, info, now);
    if (cm.user) enqueueShootMail('assigned', cm.user, ROLE_LABEL.Makeup, info, now);

    // Email xác nhận chốt lịch gửi khách (nếu khách có email).
    const cus = get<any>('SELECT full_name, email FROM customers WHERE id = ?', [b.customer_id]);
    if (cus?.email) {
      enqueueBookingConfirmed(cus.email, cus.full_name, [{ code: info.code, shoot_type: info.shoot_type, shoot_date: info.shoot_date }], config.appName, id);
    }
  }

  res.status(201).json({ id });
});

/** PUT /api/shoots/:id — cập nhật + email khi gán/đổi lịch. */
router.put('/:id', (req, res) => {
  const s = get<any>('SELECT * FROM shoots WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Không tìm thấy buổi chụp' });
  const b = req.body || {};
  if (b.status && !SHOOT_STATUS.includes(b.status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const newPhotographer = b.photographer_id !== undefined ? nn(b.photographer_id) : s.photographer_id;
  const newMakeup = b.makeup_id !== undefined ? nn(b.makeup_id) : s.makeup_id;
  const cp = checkAssignee(newPhotographer, 'Photo'); if (!cp.ok) return res.status(400).json({ error: cp.error });
  const cm = checkAssignee(newMakeup, 'Makeup'); if (!cm.ok) return res.status(400).json({ error: cm.error });

  const before = { ...s };
  const now = new Date().toISOString();
  run(
    `UPDATE shoots SET title=?, package_name=?, shoot_type=?, location=?, shoot_date=?, start_time=?, end_time=?,
       photographer_id=?, makeup_id=?, total_amount=?, deposit_amount=?, paid_full=?, status=?, note=?, updated_at=?
     WHERE id=?`,
    [
      b.title !== undefined ? nn(b.title) : s.title,
      b.package_name !== undefined ? nn(b.package_name) : s.package_name,
      b.shoot_type !== undefined ? nn(b.shoot_type) : s.shoot_type,
      b.location !== undefined ? nn(b.location) : s.location,
      b.shoot_date !== undefined ? nn(b.shoot_date) : s.shoot_date,
      b.start_time !== undefined ? nn(b.start_time) : s.start_time,
      b.end_time !== undefined ? nn(b.end_time) : s.end_time,
      newPhotographer, newMakeup,
      // deposit_amount & paid_full do bảng payments quản lý — không nhận từ body để tránh lệch số liệu.
      b.total_amount ?? s.total_amount, s.deposit_amount, s.paid_full,
      b.status ?? s.status, b.note !== undefined ? nn(b.note) : s.note, now, req.params.id,
    ]
  );
  // Nếu đổi tổng tiền -> tính lại paid_full theo tổng đã thu (tránh lệch khi hạ/nâng giá).
  if (b.total_amount !== undefined && Number(b.total_amount) !== Number(s.total_amount)) {
    const paid = (get<{ s: number }>('SELECT COALESCE(SUM(so_tien),0) AS s FROM payments WHERE shoot_id = ?', [req.params.id])?.s) || 0;
    const newTotal = Number(b.total_amount) || 0;
    run('UPDATE shoots SET deposit_amount = ?, paid_full = ? WHERE id = ?', [paid, newTotal > 0 && paid >= newTotal ? 1 : 0, req.params.id]);
  }
  persist();

  // Gửi email thông báo
  const after = get<any>('SELECT * FROM shoots WHERE id = ?', [req.params.id]);
  const info = mailInfo(req.params.id);
  const nowCancelled = after.status === 'Đã hủy';
  const wasCancelled = before.status === 'Đã hủy';

  const handle = (role: 'Photo' | 'Makeup', beforeId: string | null, afterId: string | null) => {
    const changed = beforeId !== afterId;
    if (changed) {
      // người cũ bị gỡ -> báo hủy phân công
      const oldU = userById(beforeId);
      if (oldU && !wasCancelled) enqueueShootMail('cancelled', oldU, ROLE_LABEL[role], mailInfo(req.params.id), now + ':unassign');
      // người mới -> báo phân công (nếu buổi chưa hủy)
      const newU = userById(afterId);
      if (newU && !nowCancelled) enqueueShootMail('assigned', newU, ROLE_LABEL[role], info, now);
    } else if (afterId && !nowCancelled && !wasCancelled && scheduleChanged(before, after)) {
      // vẫn người đó nhưng lịch đổi -> báo cập nhật
      const u = userById(afterId);
      if (u) enqueueShootMail('updated', u, ROLE_LABEL[role], info, now);
    } else if (afterId && nowCancelled && !wasCancelled) {
      // buổi chụp vừa chuyển sang hủy -> báo hủy cho người đang giữ
      const u = userById(afterId);
      if (u) enqueueShootMail('cancelled', u, ROLE_LABEL[role], info, now + ':cancel');
    }
  };
  handle('Photo', before.photographer_id, after.photographer_id);
  handle('Makeup', before.makeup_id, after.makeup_id);

  // Buổi vừa chuyển sang Đã hủy -> email báo khách (nếu có email).
  if (nowCancelled && !wasCancelled) {
    const cus = get<any>(
      `SELECT c.full_name, c.email, s.code, s.shoot_type, s.shoot_date
       FROM shoots s JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`, [req.params.id]);
    if (cus?.email) {
      enqueueBookingCancelled(cus.email, cus.full_name, { code: cus.code, shoot_type: cus.shoot_type, shoot_date: cus.shoot_date }, config.appName, now);
    }
  }

  res.json({ ok: true });
});

/**
 * POST /api/shoots/:id/reassign — tách/chuyển buổi chụp sang khách khác.
 * body: { customer_id } để gắn vào khách có sẵn, HOẶC { new_customer: { full_name, phone?, email?, address? } }
 * để tạo khách mới (SĐT/email KHÔNG bắt buộc — dùng cho dọn dữ liệu nhập từ Google).
 */
router.post('/:id/reassign', (req, res) => {
  const shoot = get<{ id: string }>('SELECT id FROM shoots WHERE id = ?', [req.params.id]);
  if (!shoot) return res.status(404).json({ error: 'Không tìm thấy buổi chụp' });
  const b = req.body || {};
  let targetId: string | null = null;

  if (b.customer_id) {
    const c = get<{ id: string }>('SELECT id FROM customers WHERE id = ?', [b.customer_id]);
    if (!c) return res.status(400).json({ error: 'Khách hàng không tồn tại' });
    targetId = b.customer_id;
  } else if (b.new_customer && String(b.new_customer.full_name || '').trim()) {
    const nc = b.new_customer;
    const now = new Date().toISOString();
    const id = uuid();
    run(
      `INSERT INTO customers (id, code, full_name, phone, email, address, note, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, nextCode('customers', 'KH'), String(nc.full_name).trim(), nc.phone || null, nc.email || null, nc.address || null,
       'Tách từ lịch nhập Google — bổ sung SĐT/email sau.', req.user!.id, now, now]
    );
    targetId = id;
  } else {
    return res.status(400).json({ error: 'Cần chọn khách có sẵn hoặc nhập tên khách mới' });
  }

  run('UPDATE shoots SET customer_id = ?, updated_at = ? WHERE id = ?', [targetId, new Date().toISOString(), req.params.id]);
  persist();
  res.json({ ok: true, customer_id: targetId });
});

/** DELETE /api/shoots/:id — xóa buổi chụp + giao hình liên quan. */
router.delete('/:id', (req, res) => {
  const s = get<{ id: string }>('SELECT id FROM shoots WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Không tìm thấy buổi chụp' });
  // Dọn toàn bộ dữ liệu liên quan để không còn bản ghi mồ côi.
  run('DELETE FROM deliveries WHERE shoot_id = ?', [req.params.id]);
  run('DELETE FROM payments WHERE shoot_id = ?', [req.params.id]);
  // Chi phí có thể gắn buổi chụp (shoot_id) — gỡ liên kết, giữ lại khoản chi để sổ sách không hụt.
  run('UPDATE expenses SET shoot_id = NULL WHERE shoot_id = ?', [req.params.id]);
  run('DELETE FROM shoots WHERE id = ?', [req.params.id]);
  persist();
  res.json({ ok: true });
});

export default router;
