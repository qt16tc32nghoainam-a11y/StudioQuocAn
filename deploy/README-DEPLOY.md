# Hướng dẫn deploy Wedding Admin lên VPS (phương án B: ổn định + Litestream)

Phương án: **1 VPS** chạy app ổn định (pm2 tự bật lại khi crash, systemd tự lên khi reboot)
+ **Litestream** sao lưu file SQLite liên tục ra cloud storage. Khi VM chết, dựng VM mới rồi
khôi phục DB từ bản sao lưu → gần như không mất dữ liệu.

## VPS host cả 2 site (Cách B)

VPS chạy **2 thứ** trên 2 cổng khác nhau:

| Site | Cổng | Ai dùng |
|---|---|---|
| **App quản trị** (Node) | `4100` | Nội bộ (5 người): quản lý nội dung + khách chụp |
| **Website khách xem** (tĩnh, build từ `tools/build_site.py`) | `8080` | Khách hàng xem |

Khi bật `BUILD_SITE_LOCAL=true` trong `.env`, mỗi lần bấm **Công bố** trong app:
sửa `data/*.json` → chạy `build_site.py` → thư mục `_site` được dựng lại → website khách xem
đổi ngay (không cần Netlify). Cần **python3** trên VPS (setup.sh tự cài).

Truy cập khi chưa có tên miền:
- App quản trị: `http://IP-VPS:4100`
- Website khách xem: `http://IP-VPS:8080`

Khi có tên miền, Caddy map: `studioquocan.vn` → cổng 8080, `admin.studioquocan.vn` → cổng 4100.

## 0. Chuẩn bị

- VPS **Ubuntu 22.04**, 2 vCPU / 2 GB RAM / 20–40 GB SSD (nhà VN như AZDIGI, TinoHost…).
- Quyền **root qua SSH**.
- Tên miền cho app: **`admin.studioquocan.vn`** — tạo bản ghi **A** trỏ về IP VPS
  (subdomain riêng, tách khỏi website khách xem). Có thể chạy tạm bằng IP nếu chưa mua/trỏ xong.
- 1 **GitHub Personal Access Token** (scope repo / Contents read-write cho `website-Wedding`) — để nút Công bố hoạt động.
- 1 **bucket object storage** cho Litestream: AWS S3, hoặc rẻ hơn Cloudflare R2 / Backblaze B2 /
  object storage nhà VN (Bizfly, Vietnix…). Lấy: bucket name, endpoint, access key, secret key.

## 1. Đưa code lên GitHub (làm ở máy của bạn — 1 lần)

```bash
cd /Users/m/Documents/AI/Wedding-Admin
git init -b main
git add .
git commit -m "Wedding Admin - bản deploy"
git remote add origin git@github.com:qt16tc32nghoainam-a11y/StudioQuocAn.git
git push -u origin main
```

> VPS sẽ `git clone` từ repo này. Nếu repo để private, trên VPS cần thêm SSH deploy key,
> hoặc đổi `REPO_URL` trong `setup.sh` sang dạng HTTPS kèm token. Repo public thì clone thẳng.

## 2. Cài đặt trên VPS (chạy 1 lần)

```bash
ssh root@IP-VPS
# Nếu repo public, tải nhanh script:
git clone https://github.com/qt16tc32nghoainam-a11y/StudioQuocAn.git /opt/wedding-admin
cd /opt/wedding-admin
sudo bash deploy/setup.sh
```

Script tự: cài Node 20, pm2, Caddy, Litestream → build app → tạo DB + tài khoản mặc định →
chạy app nền bằng pm2 → bật tường lửa.

**Tài khoản mặc định:** `admin` / `admin123` và `nhanvien` / `123456` — **đổi ngay** sau khi vào.

## 3. Điền cấu hình `.env`

```bash
nano /opt/wedding-admin/app/backend/.env
```

Bắt buộc sửa:
- `JWT_SECRET` → chuỗi ngẫu nhiên (tạo bằng `openssl rand -hex 32`)
- `APP_ENCRYPTION_KEY` → chuỗi ngẫu nhiên khác (mã hóa mật khẩu SMTP; đừng đổi sau khi đã lưu SMTP)
- `GITHUB_TOKEN` → token đã tạo ở bước 0

### Email tự động (SMTP) — cấu hình trong app

Sau khi đăng nhập Admin, vào menu **Cấu hình email**:
- Gmail: host `smtp.gmail.com`, cổng `587`, bỏ chọn SSL, dùng **Mật khẩu ứng dụng** (App Password, tạo trong Google Account → Security → 2-Step Verification → App passwords), KHÔNG dùng mật khẩu đăng nhập Gmail.
- Bấm **Kiểm tra kết nối** rồi **Gửi thử** để chắc chắn.
- Khi gán nhân viên Photo/Makeup vào buổi chụp (hoặc đổi ngày/giờ/địa điểm), hệ thống tự gửi email cho họ. Email đi qua hàng đợi, nếu SMTP lỗi sẽ tự thử lại, không ảnh hưởng việc lưu lịch.

Xong thì:
```bash
pm2 restart wedding-admin
```

## 4. Tên miền + HTTPS (Caddy)

Trước tiên vào trang quản lý tên miền `studioquocan.vn`, tạo bản ghi **A**:
`admin.studioquocan.vn` → IP VPS. Đợi DNS phân giải (kiểm tra: `ping admin.studioquocan.vn`).

```bash
nano /etc/caddy/Caddyfile     # đã điền sẵn admin.studioquocan.vn — sửa nếu muốn khác
systemctl reload caddy
```

Caddy tự xin chứng chỉ HTTPS (Let's Encrypt) khi tên miền đã trỏ đúng IP. Mở
`https://admin.studioquocan.vn` là vào app.

> Chưa có tên miền? Mở `deploy/Caddyfile`, dùng khối `:80` (đã ghi chú sẵn) rồi truy cập
> tạm bằng `http://IP-VPS`.

## 5. Bật Litestream (sao lưu SQLite liên tục)

1. Điền đích lưu:
   ```bash
   cp /opt/wedding-admin/deploy/litestream.yml /etc/litestream.yml
   nano /etc/litestream.yml     # điền bucket, endpoint, path
   ```
2. Đặt khóa truy cập storage (không ghi vào file yml):
   ```bash
   nano /etc/litestream.env
   ```
   Nội dung:
   ```
   LITESTREAM_ACCESS_KEY_ID=xxxx
   LITESTREAM_SECRET_ACCESS_KEY=yyyy
   ```
3. Cài dịch vụ nền:
   ```bash
   cp /opt/wedding-admin/deploy/litestream.service /etc/systemd/system/litestream.service
   systemctl daemon-reload
   systemctl enable --now litestream
   systemctl status litestream        # phải thấy active (running)
   ```

Từ giờ mọi thay đổi DB được đẩy lên cloud gần như tức thì.

## 6. Khi VM chết — dựng lại nhanh (kịch bản khôi phục)

Trên VPS mới (Ubuntu 22.04):

```bash
git clone https://github.com/qt16tc32nghoainam-a11y/StudioQuocAn.git /opt/wedding-admin
cd /opt/wedding-admin

# Cấu hình lại Litestream trước để script khôi phục được DB:
sudo cp deploy/litestream.yml /etc/litestream.yml && sudo nano /etc/litestream.yml
sudo nano /etc/litestream.env

# Chạy cài đặt — script tự phát hiện có bản sao lưu và KHÔI PHỤC DB thay vì tạo mới:
sudo bash deploy/setup.sh
```

Nếu cần khôi phục thủ công:
```bash
litestream restore -o /opt/wedding-admin/data/wedding-admin.db /opt/wedding-admin/data/wedding-admin.db
pm2 restart wedding-admin
```

Bản clone repo website (`data/website-repo`) **không cần backup** — nó tự clone lại từ GitHub
khi app khởi động. Chỉ file DB là quan trọng, và Litestream lo phần đó.

## 7. Cập nhật app khi sửa code (lần sau)

Ở máy bạn: sửa code → `git push`. Trên VPS:
```bash
sudo bash /opt/wedding-admin/deploy/update.sh
```

## Lệnh quản trị hay dùng

| Việc | Lệnh |
|---|---|
| Xem app đang chạy | `pm2 status` |
| Xem log app | `pm2 logs wedding-admin` |
| Khởi động lại app | `pm2 restart wedding-admin` |
| Xem log sao lưu | `journalctl -u litestream -f` |
| Kiểm tra bản sao lưu mới nhất | `litestream snapshots /opt/wedding-admin/data/wedding-admin.db` |
| Reload cấu hình web/HTTPS | `systemctl reload caddy` |

## Vì sao phương án này đủ tốt cho 5 người dùng

- **App crash** → pm2 bật lại trong ~2 giây (khách gần như không thấy).
- **VM reboot** → systemd + pm2 tự chạy app lại.
- **VM chết hẳn** → dựng VM mới (~15–30 phút) + khôi phục DB từ Litestream (mất tối đa vài giây dữ liệu cuối).
- **Snapshot VM hằng ngày** (bật trong panel nhà cung cấp) là lớp phòng thủ thứ hai.

Đây là mức "không mất dữ liệu, downtime ngắn" hợp lý nhất trong ngân sách ~200k/tháng, không cần
cụm HA phức tạp (vốn phải bỏ SQLite và tốn gấp nhiều lần — thừa với quy mô 5 người).
