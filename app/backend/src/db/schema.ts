/**
 * Schema SQLite cho Wedding Admin (Quốc An Studio).
 *
 * Hai nhóm dữ liệu:
 *  A) Vận hành app: users (đăng nhập/phân quyền), publish_log (lịch sử công bố website).
 *  B) Quản lý khách chụp: customers (khách hàng), shoots (buổi chụp / hợp đồng chụp),
 *     deliveries (giao hình). Theo dõi: ngày chụp, chụp ai, ngày giao hình, đã làm hình chưa,
 *     ngày khách cần ảnh, đã hoàn thành & gửi ảnh cho khách chưa.
 *
 * Nội dung website (bảng giá, bộ sưu tập, đội ngũ...) KHÔNG lưu trong DB — nó là các file
 * data/*.json trong repo website. App đọc/ghi trực tiếp các file đó (xem module content).
 */
export const SCHEMA_SQL = `
-- Người dùng nội bộ (đăng nhập + phân quyền)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin','NhanVien')),
  status TEXT NOT NULL DEFAULT 'Hoạt động' CHECK (status IN ('Hoạt động','Tạm khóa')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Lịch sử công bố nội dung lên website (audit)
CREATE TABLE IF NOT EXISTS publish_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  targets TEXT,              -- JSON: danh sách file data đã đổi (vd ["bang-gia.json"])
  message TEXT,              -- nội dung commit
  commit_hash TEXT,          -- mã commit trên GitHub (nếu push thành công)
  status TEXT NOT NULL,      -- 'success' | 'failed'
  error TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Khách hàng chụp ảnh
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,          -- mã khách dễ đọc (KH000001)
  full_name TEXT NOT NULL,   -- tên khách / cặp đôi (VD: "Ngọc Quang & Kiều Phúc")
  phone TEXT,
  email TEXT,
  address TEXT,
  source TEXT,               -- nguồn: Facebook / Zalo / Giới thiệu / Hotline...
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Buổi chụp / gói chụp của khách
CREATE TABLE IF NOT EXISTS shoots (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,                 -- mã buổi chụp (BC000001)
  customer_id TEXT NOT NULL,
  title TEXT,                       -- tên buổi chụp (VD: "Chụp ngoại cảnh - gói VIP")
  package_name TEXT,                -- gói dịch vụ khách chọn
  shoot_type TEXT,                  -- loại: Ngoại cảnh / Phim trường / Studio / Đám hỏi / Phóng sự...
  location TEXT,                    -- địa điểm chụp
  shoot_date TEXT,                  -- NGÀY CHỤP
  photographer_id TEXT,             -- người chụp (user)
  makeup_id TEXT,                   -- người trang điểm (user)
  total_amount REAL DEFAULT 0,      -- tổng tiền
  deposit_amount REAL DEFAULT 0,    -- đã cọc
  paid_full INTEGER NOT NULL DEFAULT 0,  -- đã thanh toán đủ chưa
  status TEXT NOT NULL DEFAULT 'Đã đặt lịch'
    CHECK (status IN ('Đã đặt lịch','Đã chụp','Đang xử lý hình','Chờ giao','Hoàn tất','Đã hủy')),
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (photographer_id) REFERENCES users(id),
  FOREIGN KEY (makeup_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Giao hình: theo dõi tiến độ hậu kỳ & bàn giao ảnh cho khách
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  shoot_id TEXT NOT NULL,
  due_date TEXT,                    -- NGÀY KHÁCH CẦN ẢNH / hạn giao
  editor_id TEXT,                   -- người làm hậu kỳ (user)
  editing_done INTEGER NOT NULL DEFAULT 0,      -- ĐÃ LÀM HÌNH CHƯA
  editing_done_at TEXT,             -- thời điểm làm xong hình
  delivered INTEGER NOT NULL DEFAULT 0,         -- ĐÃ GỬI ẢNH CHO KHÁCH CHƯA
  delivered_at TEXT,                -- NGÀY GIAO HÌNH thực tế
  delivery_method TEXT,             -- cách giao: Google Drive / USB / In / Link...
  delivery_link TEXT,               -- link ảnh (nếu giao online)
  photo_count INTEGER,              -- số ảnh giao
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (shoot_id) REFERENCES shoots(id),
  FOREIGN KEY (editor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shoots_customer ON shoots(customer_id);
CREATE INDEX IF NOT EXISTS idx_shoots_date ON shoots(shoot_date);
CREATE INDEX IF NOT EXISTS idx_shoots_status ON shoots(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_shoot ON deliveries(shoot_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_due ON deliveries(due_date);
CREATE INDEX IF NOT EXISTS idx_publish_created ON publish_log(created_at);
`;
