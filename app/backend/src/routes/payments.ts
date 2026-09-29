import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist } from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
// Tiền bạc: chỉ Admin xem/sửa. Makeup/Photo không thấy.
router.use(authenticate, requireRole('Admin'));

const LOAI = ['Đặt cọc', 'Thanh toán thêm', 'Tất toán'];

/** GET /api/payments/shoot/:shootId — danh sách thu tiền của 1 buổi chụp + tổng hợp. */
router.get('/shoot/:shootId', (req, res) => {
  const shoot = get<any>('SELECT total_amount FROM shoots WHERE id = ?', [req.params.shootId]);
  if (!shoot) return res.status(404).json({ error: 'Không tìm thấy buổi chụp' });
  const list = all('SELECT * FROM payments WHERE shoot_id = ? ORDER BY ngay ASC, created_at ASC', [req.params.shootId]);
  const paid = list.reduce((s: number, p: any) => s + (Number(p.so_tien) || 0), 0);
  const total = Number(shoot.total_amount) || 0;
  res.json({ payments: list, total, paid, remaining: Math.max(0, total - paid) });
});

/** POST /api/payments — thêm 1 lần thu tiền cho buổi chụp. */
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.shoot_id) return res.status(400).json({ error: 'Thiếu buổi chụp' });
  if (!b.so_tien || Number(b.so_tien) <= 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' });
  if (b.loai && !LOAI.includes(b.loai)) return res.status(400).json({ error: 'Loại thu không hợp lệ' });
  const shoot = get<{ id: string }>('SELECT id FROM shoots WHERE id = ?', [b.shoot_id]);
  if (!shoot) return res.status(400).json({ error: 'Buổi chụp không tồn tại' });

  const now = new Date().toISOString();
  const id = uuid();
  run(
    `INSERT INTO payments (id, shoot_id, ngay, so_tien, loai, phuong_thuc, note, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, b.shoot_id, b.ngay || now.slice(0, 10), Number(b.so_tien), b.loai || 'Đặt cọc', b.phuong_thuc || null, b.note || null, req.user!.id, now]
  );
  syncDeposit(b.shoot_id);
  persist();
  res.status(201).json({ id });
});

/** PUT /api/payments/:id — sửa 1 lần thu tiền. */
router.put('/:id', (req, res) => {
  const p = get<any>('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy khoản thu' });
  const b = req.body || {};
  if (b.loai && !LOAI.includes(b.loai)) return res.status(400).json({ error: 'Loại thu không hợp lệ' });
  run(
    `UPDATE payments SET ngay=?, so_tien=?, loai=?, phuong_thuc=?, note=? WHERE id=?`,
    [b.ngay ?? p.ngay, b.so_tien != null ? Number(b.so_tien) : p.so_tien, b.loai ?? p.loai, b.phuong_thuc ?? p.phuong_thuc, b.note ?? p.note, req.params.id]
  );
  syncDeposit(p.shoot_id);
  persist();
  res.json({ ok: true });
});

/** DELETE /api/payments/:id */
router.delete('/:id', (req, res) => {
  const p = get<any>('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy khoản thu' });
  run('DELETE FROM payments WHERE id = ?', [req.params.id]);
  syncDeposit(p.shoot_id);
  persist();
  res.json({ ok: true });
});

/** Đồng bộ tiền cọc + đã thanh toán đủ trên buổi chụp theo tổng các khoản thu. */
function syncDeposit(shootId: string) {
  const shoot = get<any>('SELECT total_amount FROM shoots WHERE id = ?', [shootId]);
  if (!shoot) return;
  const paid = (get<{ s: number }>('SELECT COALESCE(SUM(so_tien),0) AS s FROM payments WHERE shoot_id = ?', [shootId])?.s) || 0;
  const total = Number(shoot.total_amount) || 0;
  const paidFull = total > 0 && paid >= total ? 1 : 0;
  run('UPDATE shoots SET deposit_amount = ?, paid_full = ?, updated_at = ? WHERE id = ?', [paid, paidFull, new Date().toISOString(), shootId]);
}

export default router;
