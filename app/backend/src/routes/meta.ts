import { Router } from 'express';
import { all } from '../db/database';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/** GET /api/meta/staff — danh sách nhân sự (để chọn người chụp / trang điểm / hậu kỳ). */
router.get('/staff', (_req, res) => {
  res.json(all("SELECT id, full_name, role FROM users WHERE status = 'Hoạt động' ORDER BY full_name ASC"));
});

/** GET /api/meta/options — các giá trị enum dùng cho dropdown ở frontend. */
router.get('/options', (_req, res) => {
  res.json({
    shootStatus: ['Đã đặt lịch', 'Đã chụp', 'Đang xử lý hình', 'Chờ giao', 'Hoàn tất', 'Đã hủy'],
    shootTypes: ['Ngoại cảnh', 'Phim trường', 'Studio', 'Concept Beauty', 'Make-up cô dâu', 'Phóng sự cưới', 'Đám hỏi', 'Mâm quả cưới hỏi', 'Gia đình & Baby', 'Khác'],
    sources: ['Facebook', 'Zalo', 'Instagram', 'Giới thiệu', 'Hotline', 'Website', 'Khác'],
    deliveryMethods: ['Google Drive', 'Link tải', 'USB', 'In ảnh', 'Zalo', 'Khác'],
    paymentTypes: ['Đặt cọc', 'Thanh toán thêm', 'Tất toán'],
    paymentMethods: ['Tiền mặt', 'Chuyển khoản', 'Khác'],
    expenseTypes: ['Marketing', 'Thuê xe/di chuyển', 'Đạo cụ/trang phục', 'In ấn', 'Lương ekip', 'Mặt bằng', 'Thiết bị', 'Khác'],
  });
});

export default router;
