import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { get, run, persist } from '../db/database';
import { authenticate } from '../middleware/auth';
import { AuthUser } from '../types';

const router = Router();

/** POST /api/auth/login — đăng nhập bằng tên đăng nhập (hoặc email) + mật khẩu. */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' });

  const user = get<any>('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
  if (!user) return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
  if (user.status === 'Tạm khóa') return res.status(403).json({ error: 'Tài khoản đã bị tạm khóa' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
  };
  const token = jwt.sign(authUser, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as any);
  res.json({ token, user: authUser });
});

/** GET /api/auth/me — thông tin người dùng hiện tại. */
router.get('/me', authenticate, (req, res) => {
  const u = get<any>('SELECT id, full_name, username, email, phone, role, status FROM users WHERE id = ?', [req.user!.id]);
  if (!u) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json(u);
});

/** POST /api/auth/change-password — người dùng tự đổi mật khẩu của mình. */
router.post('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'Thiếu mật khẩu' });
  if (String(new_password).length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải từ 6 ký tự' });

  const user = get<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  }
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    bcrypt.hashSync(new_password, 8), new Date().toISOString(), req.user!.id,
  ]);
  persist();
  res.json({ ok: true });
});

export default router;
