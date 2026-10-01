import { Router } from 'express';
import { all, get, run, persist } from '../db/database';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/** GET /api/notifications — danh sách thông báo của chính mình (mới nhất trước, tối đa 50). */
router.get('/', (req, res) => {
  const rows = all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.user!.id]
  ).map((n: any) => ({ ...n, is_read: !!n.is_read }));
  res.json(rows);
});

/** GET /api/notifications/unread-count — số thông báo chưa đọc (cho badge chuông). */
router.get('/unread-count', (req, res) => {
  const n = get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user!.id]);
  res.json({ count: n?.n || 0 });
});

/** POST /api/notifications/:id/read — đánh dấu 1 thông báo đã đọc. */
router.post('/:id/read', (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);
  persist();
  res.json({ ok: true });
});

/** POST /api/notifications/read-all — đánh dấu tất cả đã đọc. */
router.post('/read-all', (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user!.id]);
  persist();
  res.json({ ok: true });
});

export default router;
