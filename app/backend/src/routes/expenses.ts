import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist } from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
// Chi phí: chỉ Admin.
router.use(authenticate, requireRole('Admin'));

/** GET /api/expenses — danh sách chi phí, lọc ?from= &to= &shoot_id= */
router.get('/', (req, res) => {
  const { from, to, shoot_id } = req.query as Record<string, string>;
  const where: string[] = [];
  const params: any[] = [];
  if (from) { where.push('e.ngay >= ?'); params.push(from); }
  if (to) { where.push('e.ngay <= ?'); params.push(to); }
  if (shoot_id) { where.push('e.shoot_id = ?'); params.push(shoot_id); }
  const sql = `
    SELECT e.*, s.code AS shoot_code, c.full_name AS customer_name
    FROM expenses e
    LEFT JOIN shoots s ON s.id = e.shoot_id
    LEFT JOIN customers c ON c.id = s.customer_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY e.ngay DESC, e.created_at DESC`;
  res.json(all(sql, params));
});

/** POST /api/expenses */
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.so_tien || Number(b.so_tien) <= 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' });
  const now = new Date().toISOString();
  const id = uuid();
  run(
    `INSERT INTO expenses (id, ngay, loai, so_tien, mo_ta, shoot_id, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, b.ngay || now.slice(0, 10), b.loai || null, Number(b.so_tien), b.mo_ta || null, b.shoot_id || null, req.user!.id, now]
  );
  persist();
  res.status(201).json({ id });
});

/** PUT /api/expenses/:id */
router.put('/:id', (req, res) => {
  const e = get<any>('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
  if (!e) return res.status(404).json({ error: 'Không tìm thấy chi phí' });
  const b = req.body || {};
  run(
    `UPDATE expenses SET ngay=?, loai=?, so_tien=?, mo_ta=?, shoot_id=? WHERE id=?`,
    [b.ngay ?? e.ngay, b.loai ?? e.loai, b.so_tien != null ? Number(b.so_tien) : e.so_tien, b.mo_ta ?? e.mo_ta, b.shoot_id !== undefined ? (b.shoot_id || null) : e.shoot_id, req.params.id]
  );
  persist();
  res.json({ ok: true });
});

/** DELETE /api/expenses/:id */
router.delete('/:id', (req, res) => {
  const e = get<{ id: string }>('SELECT id FROM expenses WHERE id = ?', [req.params.id]);
  if (!e) return res.status(404).json({ error: 'Không tìm thấy chi phí' });
  run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  persist();
  res.json({ ok: true });
});

export default router;
