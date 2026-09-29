#!/usr/bin/env bash
# =====================================================================
#  Cài đặt Wedding Admin trên VPS Ubuntu 22.04 (chạy 1 lần với quyền root)
#  Dùng: ssh vào VPS -> tải/clone code -> sudo bash deploy/setup.sh
# =====================================================================
set -euo pipefail

APP_DIR=/opt/wedding-admin
REPO_URL="${REPO_URL:-git@github.com:qt16tc32nghoainam-a11y/StudioQuocAn.git}"
NODE_MAJOR=20

echo "==> [1/8] Cập nhật hệ thống + gói cơ bản (kèm python3 để build website - Cách B)"
apt-get update -y
apt-get install -y curl git ca-certificates ufw python3 python3-pip

echo "==> [2/8] Cài Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

echo "==> [3/8] Cài pm2 (Caddy cài sau, khi có tên miền)"
npm install -g pm2
# Caddy chỉ cần khi gắn tên miền + HTTPS. Lúc chưa có tên miền, truy cập trực tiếp qua IP:cổng.
# Nếu muốn cài Caddy luôn (bỏ qua nếu lỗi mạng, không chặn cài đặt):
if ! command -v caddy >/dev/null 2>&1; then
  ( apt-get install -y debian-keyring debian-archive-keyring apt-transport-https \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list \
    && apt-get update -y && apt-get install -y caddy ) \
    || echo "    (!) Chưa cài được Caddy — không sao, chạy tạm qua IP. Cài lại khi gắn tên miền."
fi

echo "==> [4/8] Cài Litestream (sao lưu SQLite liên tục)"
if ! command -v litestream >/dev/null 2>&1; then
  ARCH=$(dpkg --print-architecture)   # amd64 hoặc arm64
  LS_VER=0.3.13
  curl -fsSL -o /tmp/litestream.deb "https://github.com/benbjohnson/litestream/releases/download/v${LS_VER}/litestream-v${LS_VER}-linux-${ARCH}.deb"
  dpkg -i /tmp/litestream.deb || apt-get -f install -y
fi
litestream version || true

echo "==> [5/8] Lấy mã nguồn về ${APP_DIR}"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi
mkdir -p "$APP_DIR/data" /var/log/wedding-admin

echo "==> [6/8] Build backend + frontend"
cd "$APP_DIR/app/frontend"
npm ci || npm install
npm run build

cd "$APP_DIR/app/backend"
npm ci || npm install
npm run build
# Cho backend phục vụ luôn giao diện
rm -rf public && cp -r ../frontend/dist ./public

# Tạo .env nếu chưa có (nhớ mở ra điền GITHUB_TOKEN, JWT_SECRET...)
if [ ! -f "$APP_DIR/app/backend/.env" ]; then
  cp "$APP_DIR/deploy/env.production.example" "$APP_DIR/app/backend/.env"
  echo "    >>> ĐÃ TẠO .env mẫu. Hãy: nano $APP_DIR/app/backend/.env  (điền GITHUB_TOKEN, đổi JWT_SECRET)"
fi

echo "==> [7/8] Khởi tạo DB + tài khoản mặc định (nếu chưa có DB)"
if [ ! -f "$APP_DIR/data/wedding-admin.db" ]; then
  # Nếu có backup trên cloud (Litestream đã cấu hình) thì ưu tiên khôi phục thay vì tạo mới:
  if [ -f /etc/litestream.yml ] && litestream restore -if-replica-exists "$APP_DIR/data/wedding-admin.db" 2>/dev/null; then
    echo "    Đã khôi phục DB từ bản sao lưu Litestream."
  else
    npm run reset
    echo "    Đã tạo DB mới + tài khoản admin/admin123, nhanvien/123456 (ĐỔI MẬT KHẨU NGAY)."
  fi
fi

echo "==> [8/8] Bật dịch vụ nền (pm2 + systemd) + tường lửa"
# pm2 chạy app, tự bật lại khi crash; systemd giúp pm2 tự lên lại khi VM reboot.
pm2 start "$APP_DIR/deploy/ecosystem.config.js"
pm2 save
pm2 startup systemd -u root --hp /root | tail -n 1 | bash || true

# Tường lửa: mở SSH + HTTP + HTTPS + cổng app (4100) + cổng website khách xem (8080)
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow 4100/tcp || true
ufw allow 8080/tcp || true
yes | ufw enable || true

echo ""
echo "======================================================================"
echo " CÀI ĐẶT XONG PHẦN APP."
echo " Truy cập:"
echo "   - App quản trị:      http://<IP-VPS>:4100"
echo "   - Website khách xem: http://<IP-VPS>:8080   (Cách B: VPS tự build & host)"
echo " Việc còn lại (xem deploy/README-DEPLOY.md):"
echo "  1) Điền .env: nano $APP_DIR/app/backend/.env  rồi  pm2 restart wedding-admin"
echo "     (nhớ BUILD_SITE_LOCAL=true để website khách xem hoạt động)"
echo "  2) Gắn tên miền + HTTPS bằng Caddy khi có domain."
echo "  3) Bật Litestream (sao lưu DB) — xem README-DEPLOY.md."
echo "======================================================================"
