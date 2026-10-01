import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { all, get, run, persist, nextCode } from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';
import { isSale } from '../utils/scope';
import { readContent, writeContent } from '../website';

const router = Router();
router.use(authenticate);

/** Chuẩn hóa 1 bản ghi gói để trả về (parse items JSON). */
function shape(p: any) {
  if (!p) return p;
  let items: string[] = [];
  try { items = p.items ? JSON.parse(p.items) : []; } catch { items = []; }
  return { ...p, items, published: !!p.published, featured: !!p.featured };
}

/**
 * Đồng bộ các gói ĐÃ CÔNG BỐ vào bang-gia.json (khối "goi-dich-vu").
 * Chỉ ghi cục bộ vào repo website — Admin bấm "Công bố" ở trang Nội dung để đẩy lên web.
 * Lỗi phía website KHÔNG làm hỏng thao tác lưu gói (bọc try/catch ở nơi gọi).
 */
async function syncPublishedToWebsite(): Promise<void> {
  const published = all<any>('SELECT * FROM service_packages WHERE published = 1 ORDER BY sort_order ASC, created_at ASC').map(shape);
  const data = (await readContent('bang-gia.json')) || { muc: [], tom_tat_trang_chu: [] };
  if (!Array.isArray(data.muc)) data.muc = [];

  const goi = published.map((p) => ({
    ten: p.name,
    gia: p.price ? Number(p.price).toLocaleString('vi-VN') + 'đ' : 'Liên hệ',
    don_vi: p.unit || '',
    mo_ta: p.description || '',
    noi_bat: !!p.featured,
    nhom: p.items && p.items.length ? [{ tieu_de: '', muc: p.items }] : [],
  }));

  const idx = data.muc.findIndex((m: any) => m && m.ma === 'goi-dich-vu');
  const block = {
    ma: 'goi-dich-vu',
    tieu_de: 'Gói dịch vụ',
    kieu: 'the',
    nhan_menu: 'Bảng giá',
    goi,
  };
  if (idx >= 0) data.muc[idx] = { ...data.muc[idx], kieu: 'the', goi }; // giữ tiêu đề/nhãn cũ nếu có
  else data.muc.push(block);

  await writeContent('bang-gia.json', data);
}

/** GET /api/packages — danh sách gói. Sale xem được (để chọn khi tạo khách). */
router.get('/', (req, res) => {
  if (!isSale(req.user!.role)) return res.status(403).json({ error: 'Không có quyền xem gói dịch vụ' });
  const rows = all('SELECT * FROM service_packages ORDER BY sort_order ASC, created_at ASC').map(shape);
  res.json(rows);
});

// Thêm/sửa/xóa gói + công bố website: chỉ Admin.
router.use(requireRole('Admin'));

/** POST /api/packages */
router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Thiếu tên gói' });
  if (b.price != null && Number(b.price) < 0) return res.status(400).json({ error: 'Giá không hợp lệ' });
  const now = new Date().toISOString();
  const id = uuid();
  const items = Array.isArray(b.items) ? JSON.stringify(b.items.filter((x: any) => String(x || '').trim())) : null;
  run(
    `INSERT INTO service_packages (id, code, name, price, unit, description, items, published, featured, sort_order, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, nextCode('service_packages', 'GP'), String(b.name).trim(), Number(b.price) || 0, b.unit || null,
     b.description || null, items, b.published ? 1 : 0, b.featured ? 1 : 0, Number(b.sort_order) || 0, req.user!.id, now, now]
  );
  persist();
  try { await syncPublishedToWebsite(); } catch (e) { console.error('[packages] sync website lỗi:', e); }
  res.status(201).json({ id });
});

/** PUT /api/packages/:id */
router.put('/:id', async (req, res) => {
  const p = get<any>('SELECT * FROM service_packages WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy gói' });
  const b = req.body || {};
  if (b.price != null && Number(b.price) < 0) return res.status(400).json({ error: 'Giá không hợp lệ' });
  const items = b.items !== undefined
    ? (Array.isArray(b.items) ? JSON.stringify(b.items.filter((x: any) => String(x || '').trim())) : null)
    : p.items;
  run(
    `UPDATE service_packages SET name=?, price=?, unit=?, description=?, items=?, published=?, featured=?, sort_order=?, updated_at=? WHERE id=?`,
    [
      b.name !== undefined ? String(b.name).trim() : p.name,
      b.price != null ? Number(b.price) : p.price,
      b.unit !== undefined ? (b.unit || null) : p.unit,
      b.description !== undefined ? (b.description || null) : p.description,
      items,
      b.published !== undefined ? (b.published ? 1 : 0) : p.published,
      b.featured !== undefined ? (b.featured ? 1 : 0) : p.featured,
      b.sort_order != null ? Number(b.sort_order) : p.sort_order,
      new Date().toISOString(), req.params.id,
    ]
  );
  persist();
  try { await syncPublishedToWebsite(); } catch (e) { console.error('[packages] sync website lỗi:', e); }
  res.json({ ok: true });
});

/** DELETE /api/packages/:id */
router.delete('/:id', async (req, res) => {
  const p = get<{ id: string }>('SELECT id FROM service_packages WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy gói' });
  // Gỡ liên kết ở các buổi chụp đang trỏ tới gói (giữ nguyên tổng tiền đã chốt).
  run('UPDATE shoots SET package_id = NULL WHERE package_id = ?', [req.params.id]);
  run('DELETE FROM service_packages WHERE id = ?', [req.params.id]);
  persist();
  try { await syncPublishedToWebsite(); } catch (e) { console.error('[packages] sync website lỗi:', e); }
  res.json({ ok: true });
});

export default router;
