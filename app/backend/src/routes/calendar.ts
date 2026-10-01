import { Router } from 'express';
import { all } from '../db/database';
import { authenticate } from '../middleware/auth';
import { shootScope } from '../utils/scope';

const router = Router();
router.use(authenticate);

/**
 * GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — lịch làm việc theo khoảng ngày.
 * Admin xem tất cả; Photo/Makeup chỉ xem buổi chụp mình được gán. KHÔNG trả thông tin tiền.
 * Admin có thể lọc theo 1 nhân viên: ?staff_id=
 */
router.get('/', (req, res) => {
  const { from, to, staff_id } = req.query as Record<string, string>;
  const where: string[] = [];
  const params: any[] = [];

  if (from) { where.push('s.shoot_date >= ?'); params.push(from); }
  if (to) { where.push('s.shoot_date <= ?'); params.push(to); }

  const scope = shootScope(req.user!, 's');
  if (scope.clause) { where.push(scope.clause); params.push(...scope.params); }

  // Admin lọc theo 1 nhân viên (người chụp hoặc trang điểm)
  if (staff_id && req.user!.role === 'Admin') {
    where.push('(s.photographer_id = ? OR s.makeup_id = ?)');
    params.push(staff_id, staff_id);
  }

  const sql = `
    SELECT s.id, s.code, s.title, s.shoot_type, s.shoot_date, s.start_time, s.end_time,
           s.location, s.status, s.photographer_id, s.makeup_id,
           c.full_name AS customer_name, c.phone AS customer_phone,
           pu.full_name AS photographer_name, mu.full_name AS makeup_name
    FROM shoots s
    JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users pu ON pu.id = s.photographer_id
    LEFT JOIN users mu ON mu.id = s.makeup_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.shoot_date ASC, s.start_time ASC`;
  res.json(all(sql, params));
});

export default router;
