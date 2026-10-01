import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { get, run, persist, nextCode } from '../db/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('Admin'));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface IcsEvent { summary?: string; location?: string; description?: string; date?: string; start?: string; end?: string; }

/** Bỏ unescape ICS (\, \; \n). */
function unesc(s: string): string {
  return s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

/** Nối các dòng bị gấp (folding: dòng tiếp theo bắt đầu bằng space/tab). */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Chuyển DTSTART value sang { date: YYYY-MM-DD, time?: HH:mm }. Hỗ trợ VALUE=DATE và datetime. */
function parseDt(val: string): { date?: string; time?: string } {
  const v = val.trim();
  // 20261105  (cả ngày)
  let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}` };
  // 20261105T083000 (có thể kèm Z)
  m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
  return {};
}

/** Phân tích nội dung .ics thành danh sách sự kiện. */
function parseIcs(text: string): IcsEvent[] {
  const lines = unfold(text);
  const events: IcsEvent[] = [];
  let cur: IcsEvent | null = null;
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) { cur = {}; continue; }
    if (line.startsWith('END:VEVENT')) { if (cur && cur.date) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const keyPart = line.slice(0, idx); // có thể kèm ;VALUE=DATE
    const value = line.slice(idx + 1);
    const key = keyPart.split(';')[0].toUpperCase();
    if (key === 'SUMMARY') cur.summary = unesc(value);
    else if (key === 'DESCRIPTION') cur.description = unesc(value);
    else if (key === 'LOCATION') cur.location = unesc(value);
    else if (key === 'DTSTART') { const p = parseDt(value); cur.date = p.date; cur.start = p.time; }
    else if (key === 'DTEND') { const p = parseDt(value); cur.end = p.time; }
  }
  return events;
}

/** Lấy (hoặc tạo) khách tạm "Nhập từ Google" để gắn các buổi import. */
function ensureImportCustomer(userId: string): string {
  const existing = get<{ id: string }>("SELECT id FROM customers WHERE full_name = 'Nhập từ Google Calendar'");
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const id = uuid();
  run(
    `INSERT INTO customers (id, code, full_name, phone, email, note, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, nextCode('customers', 'KH'), 'Nhập từ Google Calendar', '', 'import@local', 'Khách tạm chứa lịch nhập từ Google — hãy tách ra khách thật.', userId, now, now]
  );
  return id;
}

/**
 * POST /api/import/ics — nhập file .ics (export từ Google Calendar).
 * Mỗi sự kiện -> 1 buổi chụp gắn vào khách tạm "Nhập từ Google Calendar".
 * Chống trùng: bỏ qua sự kiện cùng ngày + cùng tiêu đề đã có.
 */
router.post('/ics', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file .ics' });
  const text = req.file.buffer.toString('utf-8');
  if (!text.includes('BEGIN:VCALENDAR')) return res.status(400).json({ error: 'File không phải định dạng lịch (.ics)' });

  const events = parseIcs(text);
  if (events.length === 0) return res.json({ imported: 0, skipped: 0, message: 'Không tìm thấy sự kiện có ngày trong file.' });

  const customerId = ensureImportCustomer(req.user!.id);
  const now = new Date().toISOString();
  let imported = 0, skipped = 0;

  for (const e of events) {
    const title = (e.summary || 'Sự kiện').slice(0, 200);
    // chống trùng: cùng khách + cùng ngày + cùng tiêu đề
    const dup = get<{ id: string }>(
      'SELECT id FROM shoots WHERE customer_id = ? AND shoot_date = ? AND IFNULL(title,\'\') = ?',
      [customerId, e.date, title]
    );
    if (dup) { skipped++; continue; }
    const sid = uuid();
    const noteText = ['Nhập từ Google Calendar', e.description ? 'Mô tả: ' + e.description : ''].filter(Boolean).join(' — ').slice(0, 500);
    run(
      `INSERT INTO shoots (id, code, customer_id, title, shoot_type, location, shoot_date, start_time, end_time, status, note, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [sid, nextCode('shoots', 'BC'), customerId, title, 'Nhập từ Google', e.location || null, e.date || null, e.start || null, e.end || null, 'Đã đặt lịch', noteText, req.user!.id, now, now]
    );
    run(
      `INSERT INTO deliveries (id, shoot_id, editing_done, delivered, raw_sent, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
      [uuid(), sid, 0, 0, 0, now, now]
    );
    imported++;
  }
  persist();
  res.json({ imported, skipped, total: events.length, customerId, message: `Đã nhập ${imported} sự kiện (bỏ qua ${skipped} trùng). Vào Khách hàng → "Nhập từ Google Calendar" để xem và tách ra khách thật.` });
});

export default router;
