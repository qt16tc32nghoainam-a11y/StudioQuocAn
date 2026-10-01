import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { smtpStatus, saveSmtpConfig, verifySmtp, sendMail } from '../mailer';
import fs from 'fs';
import { all, get, run, persist } from '../db/database';
import { processOutbox } from '../notifications';
import { config } from '../config';

const router = Router();
router.use(authenticate, requireRole('Admin'));

/** GET /api/settings/smtp — trạng thái cấu hình (không trả mật khẩu). */
router.get('/smtp', (_req, res) => {
  res.json(smtpStatus());
});

/** PUT /api/settings/smtp — lưu cấu hình. Mật khẩu rỗng = giữ nguyên. */
router.put('/smtp', (req, res) => {
  const b = req.body || {};
  saveSmtpConfig({
    host: b.host, port: b.port, secure: b.secure, user: b.user,
    fromName: b.fromName, fromEmail: b.fromEmail, enabled: b.enabled, pass: b.pass,
  }, req.user!.id);
  res.json({ ok: true, status: smtpStatus() });
});

/** POST /api/settings/smtp/test — kiểm tra kết nối SMTP. */
router.post('/smtp/test', async (_req, res) => {
  try {
    await verifySmtp();
    res.json({ ok: true, message: 'Kết nối SMTP thành công.' });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: 'Kết nối thất bại: ' + (e?.message || e) });
  }
});

/** POST /api/settings/smtp/send-test — gửi 1 email thử tới địa chỉ chỉ định. */
router.post('/smtp/send-test', async (req, res) => {
  const to = (req.body?.to || '').trim();
  if (!to) return res.status(400).json({ error: 'Nhập email nhận thử' });
  try {
    await sendMail(to, '[Quốc An Studio] Email thử nghiệm', '<p>Đây là email thử nghiệm từ hệ thống quản trị Quốc An Studio. Nếu bạn nhận được email này, cấu hình SMTP đã hoạt động.</p>');
    res.json({ ok: true, message: 'Đã gửi email thử tới ' + to });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: 'Gửi thất bại: ' + (e?.message || e) });
  }
});

/** GET /api/settings/outbox — danh sách email trong hàng đợi (?status=failed|pending|sent). */
router.get('/outbox', (req, res) => {
  const status = (req.query.status as string || '').trim();
  const where: string[] = [];
  const params: any[] = [];
  if (status) { where.push('status = ?'); params.push(status); }
  const rows = all(
    `SELECT id, recipient, recipient_name, subject, status, attempts, last_error, created_at, sent_at
     FROM email_outbox ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC LIMIT 100`, params
  );
  const counts = all(`SELECT status, COUNT(*) AS n FROM email_outbox GROUP BY status`);
  res.json({ rows, counts });
});

/** POST /api/settings/outbox/:id/retry — gửi lại 1 email lỗi (đưa về pending để worker gửi ngay). */
router.post('/outbox/:id/retry', async (req, res) => {
  const m = get<any>('SELECT id FROM email_outbox WHERE id = ?', [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Không tìm thấy email' });
  run("UPDATE email_outbox SET status='pending', attempts=0, next_attempt_at=? WHERE id=?", [new Date().toISOString(), req.params.id]);
  persist();
  processOutbox().catch(() => {}); // thử gửi ngay, không chờ
  res.json({ ok: true });
});

/** POST /api/settings/outbox/retry-all — gửi lại tất cả email đang failed. */
router.post('/outbox/retry-all', async (_req, res) => {
  run("UPDATE email_outbox SET status='pending', attempts=0, next_attempt_at=? WHERE status='failed'", [new Date().toISOString()]);
  persist();
  processOutbox().catch(() => {});
  res.json({ ok: true });
});

/** GET /api/settings/backup — tải nguyên file database (.db) để sao lưu. */
router.get('/backup', (_req, res) => {
  persist(); // chắc chắn file trên đĩa là mới nhất
  if (!fs.existsSync(config.dbPath)) return res.status(404).json({ error: 'Chưa có file database' });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="wedding-admin-backup-${stamp}.db"`);
  fs.createReadStream(config.dbPath).pipe(res);
});

/** GET /api/settings/export — xuất dữ liệu dạng JSON (khách, buổi, thu, chi, gói). */
router.get('/export', (_req, res) => {
  const data = {
    exported_at: new Date().toISOString(),
    customers: all('SELECT * FROM customers'),
    shoots: all('SELECT * FROM shoots'),
    deliveries: all('SELECT * FROM deliveries'),
    payments: all('SELECT * FROM payments'),
    expenses: all('SELECT * FROM expenses'),
    service_packages: all('SELECT * FROM service_packages'),
  };
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="wedding-admin-export-${stamp}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

export default router;
