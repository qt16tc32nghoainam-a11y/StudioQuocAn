# Wedding Admin — Bảng điều khiển Quốc An Studio

App web quản trị cho website **quocanstudio.vn**. Gồm 2 phần:

- **Quản lý nội dung website**: sửa 8 nhóm nội dung (bảng giá, bộ sưu tập, đội ngũ, đánh giá,
  tuyển dụng, banner, nhạc nền, liên hệ). Bấm **Công bố** → app commit vào repo website trên
  GitHub → Netlify tự dựng lại → website cập nhật sau khoảng 1 phút.
- **Quản lý khách chụp**: khách hàng, buổi chụp (ngày chụp, ai chụp, gói, tiền cọc…),
  theo dõi giao hình (ngày khách cần ảnh, đã làm hình chưa, đã gửi ảnh chưa, ngày giao thực tế).

Đăng nhập + phân quyền: **Admin** (toàn quyền, quản lý người dùng) và **Nhân viên**
(quản lý nội dung + khách chụp, không quản lý người dùng).

## Kiến trúc

```
app/frontend  (React + Vite)  ──REST API──►  app/backend  (Node + Express + SQLite/sql.js)
                                                    │
                                          ┌─────────┴──────────┐
                                          │ DB: users, khách,   │
                                          │ buổi chụp, giao hình│
                                          └─────────┬──────────┘
                                                    │ commit + push (simple-git)
                              repo website-Wedding (GitHub) ──► Netlify ──► website khách xem
```

Nội dung website **không** nằm trong DB — nó là các file `data/*.json` trong repo website.
Backend giữ một bản sao (clone) repo đó trong `app/backend/data/website-repo`, đọc/ghi file
JSON tại đây rồi commit + push khi Công bố.

## Công nghệ

- Backend: Node + Express + TypeScript, SQLite qua `sql.js` (thuần JS, không cần build native),
  JWT + bcrypt, `simple-git` để đẩy nội dung lên GitHub.
- Frontend: React + Vite + TypeScript + React Router.

## Chạy trên máy (dev)

Cần Node 18+.

```bash
# 1) Backend
cd app/backend
npm install
cp .env.example .env          # rồi mở .env điền cấu hình (xem bên dưới)
npm run reset                 # tạo DB + tài khoản mặc định
npm run dev                   # API chạy ở http://localhost:4100

# 2) Frontend (cửa sổ terminal khác)
cd app/frontend
npm install
npm run dev                   # mở http://localhost:5174
```

Vite tự proxy `/api` sang cổng 4100 nên không lo CORS khi dev.

### Tài khoản mặc định (sau `npm run reset`)

| Vai trò | Đăng nhập | Mật khẩu |
|---|---|---|
| Admin | `admin` | `admin123` |
| Nhân viên | `nhanvien` | `123456` |

> **Đổi mật khẩu ngay** sau lần đăng nhập đầu (menu trái → Đổi mật khẩu), và tạo tài khoản
> riêng cho từng người trong mục Người dùng.

## Cấu hình `.env` (backend)

Xem `app/backend/.env.example`. Các mục quan trọng để **Công bố** hoạt động:

| Biến | Ý nghĩa |
|---|---|
| `WEBSITE_REPO_URL` | URL HTTPS repo website (mặc định đã điền repo website-Wedding) |
| `WEBSITE_REPO_BRANCH` | Nhánh publish (mặc định `main`) |
| `GITHUB_TOKEN` | **GitHub Personal Access Token** (scope `repo`) để push. Không có token thì app chỉ commit cục bộ, chưa đẩy lên website thật. |
| `JWT_SECRET` | Đổi thành chuỗi ngẫu nhiên dài trên production |

### Tạo GitHub Token để Công bố

1. GitHub → Settings → Developer settings → **Personal access tokens** → *Fine-grained tokens*
   (hoặc *Tokens classic* với scope `repo`).
2. Cấp quyền ghi (Contents: Read and write) cho repo `website-Wedding`.
3. Dán token vào `GITHUB_TOKEN` trong `.env`. **Không commit file `.env`.**

## Build production

```bash
# Frontend -> tạo app/frontend/dist
cd app/frontend && npm install && npm run build

# Backend -> tạo app/backend/dist
cd ../backend && npm install && npm run build

# Cho backend phục vụ luôn frontend: chép frontend/dist vào backend/public
cp -r ../frontend/dist ./public
npm run reset            # tạo DB lần đầu (nếu chưa có)
npm start                # chạy toàn bộ ở http://localhost:4100
```

Khi có `app/backend/public`, backend tự phục vụ giao diện tại `/` và API tại `/api`.

## Đưa code lên GitHub

Repo code app: `git@github.com:qt16tc32nghoainam-a11y/StudioQuocAn.git`

```bash
cd /Users/m/Documents/AI/Wedding-Admin
git init -b main
git add .
git commit -m "Wedding Admin - bản đầu"
git remote add origin git@github.com:qt16tc32nghoainam-a11y/StudioQuocAn.git
git push -u origin main
```

`.gitignore` đã loại `node_modules`, `.env`, file DB, thư mục clone website và ảnh upload.

## API tóm tắt

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Người dùng (Admin) | `GET/POST/PUT/DELETE /api/users`, `POST /api/users/:id/reset-password` |
| Nội dung | `GET /api/content`, `GET/PUT /api/content/:file`, `POST /api/content/upload`, `POST /api/content/publish`, `GET /api/content/publish/log` |
| Khách hàng | `GET/POST/PUT/DELETE /api/customers` |
| Buổi chụp | `GET/POST/PUT/DELETE /api/shoots` |
| Giao hình | `GET/PUT /api/deliveries` |
| Tổng quan | `GET /api/dashboard` |
| Meta | `GET /api/meta/staff`, `GET /api/meta/options` |

## Ghi chú cho giai đoạn sau

- Bảng giá & Bộ sưu tập hiện sửa ở dạng JSON có kiểm tra hợp lệ (cấu trúc phức tạp). Có thể
  làm form riêng nếu cần.
- Có thể mở rộng: nhắc lịch chụp / hạn giao, xuất báo cáo, gắn khách chụp với album trên website.
