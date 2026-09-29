import { Router } from 'express';
import { get, all } from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/** Tính mốc đầu kỳ (YYYY-MM-DD) theo loại kỳ tính từ hôm nay. */
function periodStart(period: string): { from: string; label: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') {
    // Tuần này (bắt đầu Thứ 2)
    const day = (d.getDay() + 6) % 7; // 0 = Thứ 2
    d.setDate(d.getDate() - day);
    return { from: d.toISOString().slice(0, 10), label: 'Tuần này' };
  }
  if (period === 'year') {
    return { from: `${now.getFullYear()}-01-01`, label: `Năm ${now.getFullYear()}` };
  }
  // mặc định: tháng này
  return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, label: 'Tháng này' };
}

/**
 * GET /api/dashboard/finance?period=week|month|year — chỉ Admin.
 * Doanh thu = tiền thực thu (payments) trong kỳ. Chi phí = expenses trong kỳ. Lợi nhuận = thu - chi.
 */
router.get('/finance', requireRole('Admin'), (req, res) => {
  const period = (req.query.period as string) || 'month';
  const { from, label } = periodStart(period);
  const today = new Date().toISOString().slice(0, 10);

  const revenue = get<{ s: number }>('SELECT COALESCE(SUM(so_tien),0) AS s FROM payments WHERE ngay >= ? AND ngay <= ?', [from, today])?.s || 0;
  const expense = get<{ s: number }>('SELECT COALESCE(SUM(so_tien),0) AS s FROM expenses WHERE ngay >= ? AND ngay <= ?', [from, today])?.s || 0;

  const expenseByType = all('SELECT COALESCE(loai, \'Khác\') AS loai, SUM(so_tien) AS s FROM expenses WHERE ngay >= ? AND ngay <= ? GROUP BY loai ORDER BY s DESC', [from, today]);
  const revenueByType = all('SELECT loai, SUM(so_tien) AS s FROM payments WHERE ngay >= ? AND ngay <= ? GROUP BY loai', [from, today]);

  // Công nợ: tổng tiền buổi chụp chưa hủy - tổng đã thu (toàn thời gian)
  const totalContract = get<{ s: number }>("SELECT COALESCE(SUM(total_amount),0) AS s FROM shoots WHERE status != 'Đã hủy'")?.s || 0;
  const totalPaid = get<{ s: number }>('SELECT COALESCE(SUM(so_tien),0) AS s FROM payments')?.s || 0;

  res.json({
    period, from, to: today, label,
    revenue, expense, profit: revenue - expense,
    expenseByType, revenueByType,
    receivable: Math.max(0, totalContract - totalPaid),
  });
});

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
