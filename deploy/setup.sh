#!/usr/bin/env bash
# =====================================================================
#  Cài đặt Wedding Admin trên VPS Ubuntu 22.04 (chạy 1 lần với quyền root)
#  Dùng: ssh vào VPS -> tải/clone code -> sudo bash deploy/setup.sh
# =====================================================================
set -euo pipefail

APP_DIR=/opt/wedding-admin
REPO_URL="${REPO_URL:-git@github.com:qt16tc32nghoainam-a11y/StudioQuocAn.git}"
NODE_MAJOR=20

echo "==> [1/8] Cập nhật hệ thống + gói cơ bản"
apt-get update -y
apt-get install -y curl git ca-certificates ufw

echo "==> [2/8] Cài Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

echo "==> [3/8] Cài pm2 + Caddy"
npm install -g pm2
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
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

# Tường lửa: mở SSH + HTTP + HTTPS
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true

echo ""
echo "======================================================================"
echo " CÀI ĐẶT XONG PHẦN APP."
echo " Việc còn lại (làm thủ công, xem deploy/README-DEPLOY.md):"
echo "  1) Điền .env: nano $APP_DIR/app/backend/.env  rồi  pm2 restart wedding-admin"
echo "  2) Cấu hình tên miền + HTTPS: sửa /etc/caddy/Caddyfile, systemctl reload caddy"
echo "  3) Bật Litestream: điền /etc/litestream.yml + /etc/litestream.env,"
echo "     rồi enable dịch vụ (xem README-DEPLOY.md phần Litestream)."
echo "======================================================================"
