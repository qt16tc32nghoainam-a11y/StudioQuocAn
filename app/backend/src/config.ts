import path from 'path';
import fs from 'fs';

// Nạp biến môi trường từ file .env (không dùng thư viện ngoài để giữ dependency gọn).
(function loadDotEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf-8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
})();

const DATA_DIR = path.join(__dirname, '../data');

export const config = {
  port: parseInt(process.env.PORT || '4100', 10),
  jwtSecret: process.env.JWT_SECRET || 'wedding-admin-dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || path.join(DATA_DIR, 'wedding-admin.db'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dataDir: DATA_DIR,
  // Khóa mã hóa secret (mật khẩu SMTP) lưu trong DB. Nên đặt APP_ENCRYPTION_KEY riêng ở .env;
  // mặc định suy ra từ JWT secret để vẫn chạy được, nhưng production nên đặt khóa riêng.
  encryptionKey: process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'wedding-admin-dev-secret-change-in-production',
  appName: process.env.APP_NAME || 'Quốc An Studio',
  // Thư mục lưu ảnh upload (trước khi Công bố sẽ được sao chép vào repo website)
  uploadsDir: process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads'),
  // Cấu hình đồng bộ repo website tĩnh
  website: {
    repoUrl: process.env.WEBSITE_REPO_URL || '',
    branch: process.env.WEBSITE_REPO_BRANCH || 'main',
    githubToken: process.env.GITHUB_TOKEN || '',
    authorName: process.env.GIT_AUTHOR_NAME || 'Wedding Admin',
    authorEmail: process.env.GIT_AUTHOR_EMAIL || 'admin@quocanstudio.vn',
    repoDir: process.env.WEBSITE_REPO_DIR || path.join(DATA_DIR, 'website-repo'),
    // Thư mục chứa data JSON trong repo website
    dataSubdir: 'data',
    // Thư mục chứa ảnh upload trong repo website (khớp với build_site.py)
    uploadsSubdir: 'assets/uploads',
    // Cách B: VPS tự build website tĩnh và phục vụ cho khách xem.
    // Bật bằng BUILD_SITE_LOCAL=true. Cần python3 trên máy (build_site.py).
    buildLocal: process.env.BUILD_SITE_LOCAL === 'true',
    // Lệnh build (mặc định python3 tools/build_site.py, chạy trong thư mục repo)
    buildCmd: process.env.BUILD_SITE_CMD || 'python3 tools/build_site.py',
    // Thư mục kết quả build bên trong repo (build_site.py xuất ra _site)
    siteSubdir: '_site',
  },
};
