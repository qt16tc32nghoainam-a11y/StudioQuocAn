import { Router } from 'express';
import { get, all } from '../db/database';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/** GET /api/dashboard — số liệu tổng quan cho trang chủ app. */
router.get('/', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const totalCustomers = get<{ n: number }>('SELECT COUNT(*) AS n FROM customers')?.n || 0;
  const totalShoots = get<{ n: number }>('SELECT COUNT(*) AS n FROM shoots')?.n || 0;
  const upcomingShoots = all(
    `SELECT s.id, s.code, s.title, s.shoot_date, s.shoot_type, c.full_name AS customer_name
     FROM shoots s JOIN customers c ON c.id = s.customer_id
     WHERE s.shoot_date >= ? AND s.status != 'Đã hủy'
     ORDER BY s.shoot_date ASC LIMIT 10`,
    [today]
  );
  const pendingEditing = get<{ n: number }>('SELECT COUNT(*) AS n FROM deliveries WHERE editing_done = 0')?.n || 0;
  const pendingDelivery = get<{ n: number }>('SELECT COUNT(*) AS n FROM deliveries WHERE delivered = 0')?.n || 0;
  const overdue = all(
    `SELECT d.id, d.due_date, s.code AS shoot_code, c.full_name AS customer_name
     FROM deliveries d JOIN shoots s ON s.id = d.shoot_id JOIN customers c ON c.id = s.customer_id
     WHERE d.delivered = 0 AND d.due_date IS NOT NULL AND d.due_date < ?
     ORDER BY d.due_date ASC`,
    [today]
  );

  const statusBreakdown = all(
    'SELECT status, COUNT(*) AS n FROM shoots GROUP BY status'
  );

  res.json({
    totalCustomers,
    totalShoots,
    pendingEditing,
    pendingDelivery,
    overdueCount: overdue.length,
    upcomingShoots,
    overdue,
    statusBreakdown,
  });
});

export default router;
