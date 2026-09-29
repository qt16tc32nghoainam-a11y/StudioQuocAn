/**
 * Tạo dữ liệu khởi tạo: tài khoản Admin mặc định + vài dữ liệu mẫu.
 *   npm run seed
 *
 * Tài khoản mặc định:
 *   Admin:     admin  / admin123
 *   Nhân viên: nhanvien / 123456
 * ĐỔI MẬT KHẨU ngay sau lần đăng nhập đầu tiên trên production.
 */
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { initDb, get, run, persist, nextCode } from './database';

async function main() {
  await initDb();
  const now = new Date().toISOString();

  function ensureUser(u: { full_name: string; username: string; email: string; phone: string; password: string; role: 'Admin' | 'Makeup' | 'Photo' }) {
    const existing = get<{ id: string }>('SELECT id FROM users WHERE username = ? OR email = ?', [u.username, u.email]);
    if (existing) {
      console.log(`- Bỏ qua (đã tồn tại): ${u.username}`);
      return;
    }
    run(
      `INSERT INTO users (id, full_name, username, email, phone, password_hash, role, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [uuid(), u.full_name, u.username, u.email, u.phone, bcrypt.hashSync(u.password, 8), u.role, 'Hoạt động', now, now]
    );
    console.log(`+ Tạo user ${u.role}: ${u.username} / ${u.password}`);
  }

  ensureUser({ full_name: 'Quản trị viên', username: 'admin', email: 'admin@quocanstudio.vn', phone: '0354501333', password: 'admin123', role: 'Admin' });
  ensureUser({ full_name: 'Nhân viên Makeup', username: 'makeup', email: 'makeup@quocanstudio.vn', phone: '0334923634', password: '123456', role: 'Makeup' });
  ensureUser({ full_name: 'Nhân viên Photo', username: 'photo', email: 'photo@quocanstudio.vn', phone: '0334923635', password: '123456', role: 'Photo' });

  // Một khách + buổi chụp + giao hình mẫu để app không trống trơn.
  const hasCustomer = get<{ n: number }>('SELECT COUNT(*) AS n FROM customers');
  if (!hasCustomer || hasCustomer.n === 0) {
    const admin = get<{ id: string }>("SELECT id FROM users WHERE username = 'admin'");
    const cusId = uuid();
    run(
      `INSERT INTO customers (id, code, full_name, phone, email, address, source, note, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [cusId, nextCode('customers', 'KH'), 'Ngọc Quang & Kiều Phúc', '0900000000', '', 'Nhơn Trạch, Đồng Nai', 'Facebook', 'Khách mẫu', admin?.id || null, now, now]
    );
    const shootId = uuid();
    run(
      `INSERT INTO shoots (id, code, customer_id, title, package_name, shoot_type, location, shoot_date, total_amount, deposit_amount, paid_full, status, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [shootId, nextCode('shoots', 'BC'), cusId, 'Phóng sự cưới - Lễ dạm ngõ', 'Gói cưới trọn gói VIP', 'Phóng sự cưới', 'Phim trường An Garden',
       '2026-10-05', 7000000, 2000000, 0, 'Đã đặt lịch', admin?.id || null, now, now]
    );
    run(
      `INSERT INTO deliveries (id, shoot_id, due_date, editing_done, delivered, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [uuid(), shootId, '2026-10-20', 0, 0, now, now]
    );
    console.log('+ Tạo khách + buổi chụp + giao hình mẫu.');
  }

  persist();
  console.log('✓ Seed xong.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Lỗi seed:', e);
  process.exit(1);
});
