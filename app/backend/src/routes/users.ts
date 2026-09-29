import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist } from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Toàn bộ route quản lý user chỉ dành cho Admin.
router.use(authenticate, requireRole('Admin'));

/** GET /api/users — danh sách người dùng. */
router.get('/', (_req, res) => {
  const rows = all('SELECT id, full_name, username, email, phone, role, status, created_at, updated_at FROM users ORDER BY created_at ASC');
  res.json(rows);
});

/** POST /api/users — tạo người dùng mới. */
router.post('/', (req, res) => {
  const { full_name, username, email, phone, password, role } = req.body || {};
  if (!full_name || !username || !email || !password) {
    return res.status(400).json({ error: 'Thiếu họ tên, tên đăng nhập, email hoặc mật khẩu' });
  }
  if (!['Admin', 'NhanVien'].includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Mật khẩu phải từ 6 ký tự' });

  const dup = get<{ id: string }>('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (dup) return res.status(409).json({ error: 'Tên đăng nhập hoặc email đã tồn tại' });

  const now = new Date().toISOString();
  const id = uuid();
  run(
    `INSERT INTO users (id, full_name, username, email, phone, password_hash, role, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, full_name, username, email, phone || null, bcrypt.hashSync(password, 8), role, 'Hoạt động', now, now]
  );
  persist();
  res.status(201).json({ id });
});

/** PUT /api/users/:id — cập nhật thông tin / vai trò / trạng thái. */
router.put('/:id', (req, res) => {
  const user = get<any>('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  const { full_name, email, phone, role, status } = req.body || {};
  if (role && !['Admin', 'NhanVien'].includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ' });
  if (status && !['Hoạt động', 'Tạm khóa'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  // Không cho Admin tự khóa / tự hạ quyền chính mình (tránh mất quyền quản trị).
  if (req.params.id === req.user!.id) {
    if (status === 'Tạm khóa') return res.status(400).json({ error: 'Không thể tự khóa tài khoản của bạn' });
    if (role && role !== 'Admin') return res.status(400).json({ error: 'Không thể tự hạ quyền của bạn' });
  }

  if (email && email !== user.email) {
    const dup = get<{ id: string }>('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.params.id]);
    if (dup) return res.status(409).json({ error: 'Email đã được dùng' });
  }

  run(
    `UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, status = ?, updated_at = ? WHERE id = ?`,
    [
      full_name ?? user.full_name,
      email ?? user.email,
      phone ?? user.phone,
      role ?? user.role,
      status ?? user.status,
      new Date().toISOString(),
      req.params.id,
    ]
  );
  persist();
  res.json({ ok: true });
});

/** POST /api/users/:id/reset-password — Admin đặt lại mật khẩu cho user. */
router.post('/:id/reset-password', (req, res) => {
  const { new_password } = req.body || {};
  if (!new_password || String(new_password).length < 6) return res.status(400).json({ error: 'Mật khẩu phải từ 6 ký tự' });
  const user = get<{ id: string }>('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    bcrypt.hashSync(new_password, 8), new Date().toISOString(), req.params.id,
  ]);
  persist();
  res.json({ ok: true });
});

/** DELETE /api/users/:id — xóa người dùng (không cho tự xóa). */
router.delete('/:id', (req, res) => {
  if (req.params.id === req.user!.id) return res.status(400).json({ error: 'Không thể tự xóa tài khoản của bạn' });
  const user = get<{ id: string }>('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  run('DELETE FROM users WHERE id = ?', [req.params.id]);
  persist();
  res.json({ ok: true });
});

export default router;
