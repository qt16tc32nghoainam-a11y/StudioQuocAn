import { Router } from 'express';
import { get, all } from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';
import { shootScope, isSale } from '../utils/scope';

const router = Router();
router.use(authenticate);

/** Tính mốc đầu kỳ (YYYY-MM-DD) theo loại kỳ tính từ hôm nay. */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const vn = (s: string) => { const [y, m, dd] = s.split('-'); return `${dd}/${m}/${y}`; };

/**
 * Khoảng kỳ đầy đủ (from–to của CẢ kỳ) + label kèm ngày cụ thể.
 *  - week:  Thứ 2 → Chủ nhật của tuần hiện tại
 *  - month: ngày 1 → ngày cuối tháng hiện tại
 *  - year:  01/01 → 31/12 năm hiện tại
 */
function periodRange(period: string, customFrom?: string, customTo?: string): { from: string; to: string; label: string } {
  const now = new Date();
  // Khoảng ngày tùy chọn (ưu tiên nếu hợp lệ YYYY-MM-DD).
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (period === 'custom' && customFrom && customTo && dateRe.test(customFrom) && dateRe.test(customTo)) {
    const from = customFrom <= customTo ? customFrom : customTo;
    const to = customFrom <= customTo ? customTo : customFrom; // tự đảo nếu nhập ngược
    return { from, to, label: `${vn(from)} – ${vn(to)}` };
  }
  if (period === 'week') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = (d.getDay() + 6) % 7; // 0 = Thứ 2
    const start = new Date(d); start.setDate(d.getDate() - day);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const from = iso(start), to = iso(end);
    return { from, to, label: `Tuần ${vn(from)} – ${vn(to)}` };
  }
  if (period === 'year') {
    const y = now.getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Năm ${y}` };
  }
  // tháng
  const y = now.getFullYear(), m = now.getMonth();
  const from = iso(new Date(y, m, 1)), to = iso(new Date(y, m + 1, 0));
  return { from, to, label: `Tháng ${m + 1}/${y} (${vn(from)} – ${vn(to)})` };
}

/**
 * GET /api/dashboard/finance?period=week|month|year — chỉ Admin.
 * Doanh thu = tiền thực thu (payments) trong kỳ. Chi phí = expenses trong kỳ. Lợi nhuận = thu - chi.
 */
router.get('/finance', requireRole('Admin'), (req, res) => {
  const period = (req.query.period as string) || 'month';
  const { from, to, label } = periodRange(period, req.query.from as string, req.query.to as string);

  const revenue = get<{ s: number }>('SELECT COALESCE(SUM(so_tien),0) AS s FROM payments WHERE ngay >= ? AND ngay <= ?', [from, to])?.s || 0;
  const expense = get<{ s: number }>('SELECT COALESCE(SUM(so_tien),0) AS s FROM expenses WHERE ngay >= ? AND ngay <= ?', [from, to])?.s || 0;

  const expenseByType = all('SELECT COALESCE(loai, \'Khác\') AS loai, SUM(so_tien) AS s FROM expenses WHERE ngay >= ? AND ngay <= ? GROUP BY loai ORDER BY s DESC', [from, to]);
  const revenueByType = all('SELECT loai, SUM(so_tien) AS s FROM payments WHERE ngay >= ? AND ngay <= ? GROUP BY loai', [from, to]);

  // Công nợ: tổng tiền buổi chụp chưa hủy - tổng đã thu (toàn thời gian)
  const totalContract = get<{ s: number }>("SELECT COALESCE(SUM(total_amount),0) AS s FROM shoots WHERE status != 'Đã hủy'")?.s || 0;
  const totalPaid = get<{ s: number }>('SELECT COALESCE(SUM(so_tien),0) AS s FROM payments')?.s || 0;

  res.json({
    period, from, to, label,
    revenue, expense, profit: revenue - expense,
    expenseByType, revenueByType,
    receivable: Math.max(0, totalContract - totalPaid),
  });
});

/**
 * GET /api/dashboard/profit-by-shoot?period=... — lợi nhuận theo TỪNG BUỔI (chỉ Admin).
 * Lãi/buổi = tiền đã thu của buổi − chi phí gắn buổi. Lọc theo ngày chụp trong kỳ.
 */
router.get('/profit-by-shoot', requireRole('Admin'), (req, res) => {
  const period = (req.query.period as string) || 'month';
  const { from, to, label } = periodRange(period, req.query.from as string, req.query.to as string);
  // Tính theo tiền thực PHÁT SINH trong kỳ (thu/chi có ngày trong kỳ), không theo ngày chụp —
  // để buổi chụp tương lai đã nhận cọc trong kỳ vẫn được tính đúng doanh thu.
  const rows = all(
    `SELECT s.id, s.code, s.shoot_type, s.shoot_date, s.total_amount, c.full_name AS customer_name,
            COALESCE((SELECT SUM(so_tien) FROM payments p WHERE p.shoot_id = s.id AND p.ngay >= ? AND p.ngay <= ?), 0) AS paid,
            COALESCE((SELECT SUM(so_tien) FROM expenses e WHERE e.shoot_id = s.id AND e.ngay >= ? AND e.ngay <= ?), 0) AS cost
     FROM shoots s JOIN customers c ON c.id = s.customer_id
     WHERE s.status != 'Đã hủy'
       AND (EXISTS (SELECT 1 FROM payments p WHERE p.shoot_id = s.id AND p.ngay >= ? AND p.ngay <= ?)
         OR EXISTS (SELECT 1 FROM expenses e WHERE e.shoot_id = s.id AND e.ngay >= ? AND e.ngay <= ?))
     ORDER BY s.shoot_date DESC`,
    [from, to, from, to, from, to, from, to]
  ).map((r: any) => ({ ...r, profit: (Number(r.paid) || 0) - (Number(r.cost) || 0) }));
  const totalRevenue = rows.reduce((a: number, r: any) => a + (Number(r.paid) || 0), 0);
  const totalCost = rows.reduce((a: number, r: any) => a + (Number(r.cost) || 0), 0);
  res.json({ period, from, to, label, rows, totalRevenue, totalCost, totalProfit: totalRevenue - totalCost });
});

/**
 * GET /api/dashboard/cashbook?period=... — sổ quỹ (chỉ Admin): dòng thu/chi theo thời gian + số dư lũy kế.
 */
router.get('/cashbook', requireRole('Admin'), (req, res) => {
  const period = (req.query.period as string) || 'month';
  const { from, to, label } = periodRange(period, req.query.from as string, req.query.to as string);
  const income = all(
    `SELECT p.ngay AS ngay, p.so_tien AS so_tien, 'Thu' AS huong, p.loai AS loai,
            s.code AS shoot_code, c.full_name AS customer_name
     FROM payments p JOIN shoots s ON s.id = p.shoot_id JOIN customers c ON c.id = s.customer_id
     WHERE p.ngay >= ? AND p.ngay <= ?`, [from, to]
  );
  const outcome = all(
    `SELECT e.ngay AS ngay, e.so_tien AS so_tien, 'Chi' AS huong, COALESCE(e.loai,'Khác') AS loai,
            s.code AS shoot_code, c.full_name AS customer_name
     FROM expenses e LEFT JOIN shoots s ON s.id = e.shoot_id LEFT JOIN customers c ON c.id = s.customer_id
     WHERE e.ngay >= ? AND e.ngay <= ?`, [from, to]
  );
  // Gộp + sắp theo ngày tăng dần, tính số dư lũy kế.
  const entries = [...income, ...outcome].sort((a: any, b: any) => (a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0));
  let balance = 0;
  const ledger = entries.map((e: any) => {
    const amt = Number(e.so_tien) || 0;
    balance += e.huong === 'Thu' ? amt : -amt;
    return { ...e, balance };
  });
  const totalIn = income.reduce((a: number, r: any) => a + (Number(r.so_tien) || 0), 0);
  const totalOut = outcome.reduce((a: number, r: any) => a + (Number(r.so_tien) || 0), 0);
  res.json({ period, from, to, label, ledger, totalIn, totalOut, balance: totalIn - totalOut });
});

/** GET /api/dashboard — số liệu tổng quan. Admin xem toàn bộ; Photo/Makeup chỉ buổi chụp của mình. */
router.get('/', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  // Sale (Admin/Makeup) xem tổng quan toàn studio; Photo chỉ buổi mình chụp.
  const sale = isSale(req.user!.role);
  const scope = sale ? { clause: '', params: [] as any[] } : shootScope(req.user!, 's');
  const myClause = scope.clause ? ` AND ${scope.clause}` : '';
  const myParams = scope.params;

  const totalCustomers = sale ? (get<{ n: number }>('SELECT COUNT(*) AS n FROM customers')?.n || 0) : 0;
  const totalShoots = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM shoots s WHERE 1=1${myClause}`, myParams
  )?.n || 0;

  const upcomingShoots = all(
    `SELECT s.id, s.code, s.title, s.shoot_date, s.start_time, s.shoot_type, s.location, c.full_name AS customer_name
     FROM shoots s JOIN customers c ON c.id = s.customer_id
     WHERE s.shoot_date >= ? AND s.status != 'Đã hủy'${myClause}
     ORDER BY s.shoot_date ASC LIMIT 10`,
    [today, ...myParams]
  );

  // Tiến độ giao hình: Admin xem tất cả; nhân viên xem buổi mình phụ trách.
  const dScope = scope.clause ? ` AND ${scope.clause}` : '';
  const pendingEditing = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM deliveries d JOIN shoots s ON s.id = d.shoot_id WHERE d.editing_done = 0${dScope}`, myParams
  )?.n || 0;
  const pendingDelivery = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM deliveries d JOIN shoots s ON s.id = d.shoot_id WHERE d.delivered = 0${dScope}`, myParams
  )?.n || 0;
  // Quá hạn giao: ưu tiên ngày hẹn giao khách (promised_date), không có thì dùng hạn nội bộ (due_date) — khớp logic trang Giao hình.
  const overdue = all(
    `SELECT d.id, COALESCE(d.promised_date, d.due_date) AS due_date, s.code AS shoot_code, c.full_name AS customer_name
     FROM deliveries d JOIN shoots s ON s.id = d.shoot_id JOIN customers c ON c.id = s.customer_id
     WHERE d.delivered = 0 AND COALESCE(d.promised_date, d.due_date) IS NOT NULL AND COALESCE(d.promised_date, d.due_date) < ?${dScope}
     ORDER BY COALESCE(d.promised_date, d.due_date) ASC`,
    [today, ...myParams]
  );

  const statusBreakdown = all(
    `SELECT s.status AS status, COUNT(*) AS n FROM shoots s WHERE 1=1${myClause} GROUP BY s.status`, myParams
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
