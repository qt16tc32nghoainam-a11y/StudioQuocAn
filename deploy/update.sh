#!/usr/bin/env bash
# =====================================================================
#  Cập nhật app sau khi sửa code (đã push lên GitHub). Chạy trên VPS.
#  Dùng: sudo bash /opt/wedding-admin/deploy/update.sh
# =====================================================================
set -euo pipefail
APP_DIR=/opt/wedding-admin

echo "==> Kéo mã mới"
git -C "$APP_DIR" pull --ff-only

echo "==> Build frontend"
cd "$APP_DIR/app/frontend" && (npm ci || npm install) && npm run build

echo "==> Build backend"
cd "$APP_DIR/app/backend" && (npm ci || npm install) && npm run build
rm -rf public && cp -r ../frontend/dist ./public

echo "==> Khởi động lại app"
pm2 restart wedding-admin
pm2 save

echo "==> Xong. Xem log: pm2 logs wedding-admin"
