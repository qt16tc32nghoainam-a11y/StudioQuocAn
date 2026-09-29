import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { authenticate, requireRole } from '../middleware/auth';
import { all, run, persist } from '../db/database';
import {
  CONTENT_FILES, ContentFile, readContent, writeContent, saveUpload, publish, repoStatus, pullLatest,
} from '../website';

const router = Router();
router.use(authenticate, requireRole('Admin')); // Nội dung website: chỉ Admin

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function isValidFile(f: string): f is ContentFile {
  return (CONTENT_FILES as readonly string[]).includes(f);
}

/** GET /api/content — danh sách các file nội dung + trạng thái repo. */
router.get('/', async (_req, res, next) => {
  try {
    const status = await repoStatus();
    res.json({ files: CONTENT_FILES, repo: status });
  } catch (e) { next(e); }
});

/** GET /api/content/status — trạng thái repo (đã cấu hình, thay đổi chờ công bố). */
router.get('/status', async (_req, res, next) => {
  try {
    res.json(await repoStatus());
  } catch (e) { next(e); }
});

/** POST /api/content/pull — kéo bản mới nhất từ GitHub về (đề phòng sửa nơi khác). */
router.post('/pull', async (_req, res, next) => {
  try {
    await pullLatest();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** GET /api/content/:file — đọc 1 file nội dung. */
router.get('/:file', async (req, res, next) => {
  try {
    const file = req.params.file;
    if (!isValidFile(file)) return res.status(400).json({ error: 'File nội dung không hợp lệ' });
    const data = await readContent(file);
    res.json({ file, data });
  } catch (e) { next(e); }
});

/** PUT /api/content/:file — ghi đè toàn bộ 1 file nội dung (chưa công bố). */
router.put('/:file', async (req, res, next) => {
  try {
    const file = req.params.file;
    if (!isValidFile(file)) return res.status(400).json({ error: 'File nội dung không hợp lệ' });
    const data = req.body?.data;
    if (data === undefined || data === null) return res.status(400).json({ error: 'Thiếu dữ liệu (data)' });
    await writeContent(file, data);
    res.json({ ok: true, note: 'Đã lưu bản nháp. Bấm Công bố để đưa lên website.' });
  } catch (e) { next(e); }
});

/** POST /api/content/upload — tải 1 ảnh lên (lưu vào assets/uploads của repo website). */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
    const url = await saveUpload(req.file.originalname, req.file.buffer);
    res.json({ url });
  } catch (e) { next(e); }
});

/** POST /api/content/publish — công bố: commit + push lên GitHub. */
router.post('/publish', async (req, res, next) => {
  const now = new Date().toISOString();
  const message = (req.body?.message || 'Cập nhật nội dung website từ app quản trị').toString();
  try {
    const result = await publish(message);
    run(
      `INSERT INTO publish_log (id, user_id, user_name, targets, message, commit_hash, status, error, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [uuid(), req.user!.id, req.user!.full_name, JSON.stringify(result.changed), message, result.commitHash,
       'success', null, now]
    );
    persist();
    res.json(result);
  } catch (e) {
    run(
      `INSERT INTO publish_log (id, user_id, user_name, targets, message, commit_hash, status, error, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [uuid(), req.user!.id, req.user!.full_name, '[]', message, null, 'failed', (e as Error).message, now]
    );
    persist();
    next(e);
  }
});

/** GET /api/content/publish/log — lịch sử công bố (mới nhất trước). */
router.get('/publish/log', async (_req, res) => {
  const rows = all('SELECT * FROM publish_log ORDER BY created_at DESC LIMIT 100');
  res.json(rows.map((r: any) => ({ ...r, targets: safeParse(r.targets) })));
});

function safeParse(s: any): any {
  try { return JSON.parse(s); } catch { return s; }
}

export default router;
