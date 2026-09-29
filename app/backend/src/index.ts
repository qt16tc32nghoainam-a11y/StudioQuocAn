import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { initDb } from './db/database';
import { ensureRepo, assetsDirInRepo } from './website';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import contentRoutes from './routes/content';
import customerRoutes from './routes/customers';
import shootRoutes from './routes/shoots';
import deliveryRoutes from './routes/deliveries';
import dashboardRoutes from './routes/dashboard';
import metaRoutes from './routes/meta';

async function main() {
  await initDb();

  // Chuẩn bị bản sao repo website (clone nếu đã cấu hình). Không chặn khởi động nếu lỗi mạng.
  ensureRepo().catch((e) => console.warn('[website] Chưa sẵn sàng repo website:', e.message));

  const app = express();
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Wedding Admin API', time: new Date().toISOString() }));

  // Phục vụ ảnh của website (từ bản clone repo) để xem trực tiếp trong app quản trị.
  // Ảnh cũ /assets/img/... và ảnh upload /assets/uploads/... đều truy cập qua /website-assets/...
  app.use('/website-assets', async (req, res, next) => {
    try { await ensureRepo(); } catch { /* vẫn thử phục vụ nếu đã có sẵn */ }
    express.static(assetsDirInRepo(), { fallthrough: true })(req, res, next);
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/shoots', shootRoutes);
  app.use('/api/deliveries', deliveryRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/meta', metaRoutes);

  // Phục vụ frontend đã build (production).
  const staticDir = path.join(__dirname, '../public');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  // Error handler chung
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Lỗi:', err);
    res.status(500).json({ error: err?.message || 'Lỗi máy chủ' });
  });

  app.listen(config.port, () => {
    console.log(`Wedding Admin API chạy tại http://localhost:${config.port}`);
  });
}

main().catch((e) => {
  console.error('Không khởi động được server:', e);
  process.exit(1);
});
