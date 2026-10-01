import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { smtpStatus, saveSmtpConfig, verifySmtp, sendMail } from '../mailer';

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

export default router;
