/**
 * Lớp DB wrapper trên sql.js (SQLite biên dịch WebAssembly, thuần JS — không cần build native).
 * API tối giản: get/all/run, exec, persist. DB nạp từ file khi khởi động, ghi lại ra file sau mỗi thao tác ghi.
 */
import initSqlJs, { Database as SqlJsDatabase, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { SCHEMA_SQL } from './schema';

const DB_PATH = config.dbPath;

let db: SqlJsDatabase | null = null;
let dirty = false;

export type Row = Record<string, SqlValue>;

/** Khởi tạo DB: nạp từ file nếu có, hoặc tạo mới; áp dụng schema. */
export async function initDb(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      const candidates = [
        path.join(process.cwd(), 'node_modules/sql.js/dist', file),
        require.resolve('sql.js/dist/' + file),
      ];
      for (const c of candidates) {
        try { if (fs.existsSync(c)) return c; } catch { /* ignore */ }
      }
      return file;
    },
  });

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(buf));
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON;');
  db.run(SCHEMA_SQL); // idempotent: CREATE TABLE IF NOT EXISTS
  migrateRoles();     // DB cũ (Admin/NhanVien) -> nới CHECK sang Admin/Makeup/Photo
  migrateAddColumns();// DB cũ: thêm cột còn thiếu (start_time, end_time...)
  dirty = true;
  persist();

  // Ghi định kỳ nếu có thay đổi (an toàn dữ liệu)
  setInterval(() => {
    if (dirty) persist();
  }, 2000);
}

function ensure(): SqlJsDatabase {
  if (!db) throw new Error('DB chưa được khởi tạo. Gọi initDb() trước.');
  return db;
}

/**
 * Nới ràng buộc role của bảng users từ ('Admin','NhanVien') sang ('Admin','Makeup','Photo').
 * SQLite không ALTER được CHECK, nên phải tạo bảng mới rồi copy dữ liệu. An toàn chạy nhiều lần.
 * NhanVien cũ được chuyển thành Photo.
 */
function migrateRoles(): void {
  if (!db) return;
  try {
    const r = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    const ddl = r.length && r[0].values.length ? String(r[0].values[0][0]) : '';
    if (!ddl || !ddl.includes('NhanVien')) return; // đã là schema mới, bỏ qua

    db.run('PRAGMA foreign_keys = OFF;');
    db.run('BEGIN');
    db.run(`CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Admin','Makeup','Photo')),
      status TEXT NOT NULL DEFAULT 'Hoạt động' CHECK (status IN ('Hoạt động','Tạm khóa')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    db.run(`INSERT INTO users_new (id, full_name, username, email, phone, password_hash, role, status, created_at, updated_at)
            SELECT id, full_name, username, email, phone, password_hash,
                   CASE WHEN role = 'NhanVien' THEN 'Photo' ELSE role END,
                   status, created_at, updated_at FROM users`);
    db.run('DROP TABLE users');
    db.run('ALTER TABLE users_new RENAME TO users');
    db.run('COMMIT');
    db.run('PRAGMA foreign_keys = ON;');
    console.log('[migration] Đã chuyển role users sang Admin/Makeup/Photo (NhanVien -> Photo).');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch { /* ignore */ }
    console.error('[migration] Lỗi migrateRoles:', e);
  }
}

/**
 * Thêm cột còn thiếu cho DB đã tồn tại (an toàn, không mất dữ liệu).
 * CREATE TABLE IF NOT EXISTS không cập nhật bảng cũ nên phải ALTER thủ công.
 */
function migrateAddColumns(): void {
  if (!db) return;
  const addCol = (table: string, column: string, type: string) => {
    try {
      const r = db!.exec(`PRAGMA table_info(${table})`);
      const cols = r.length ? r[0].values.map((v) => String(v[1])) : [];
      if (cols.length && !cols.includes(column)) {
        db!.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`[migration] Đã thêm cột ${table}.${column}`);
      }
    } catch (e) {
      console.error(`[migration] Lỗi thêm cột ${table}.${column}:`, e);
    }
  };
  addCol('shoots', 'start_time', 'TEXT');
  addCol('shoots', 'end_time', 'TEXT');
  addCol('deliveries', 'raw_link', 'TEXT');
  addCol('deliveries', 'raw_sent', 'INTEGER NOT NULL DEFAULT 0');
  addCol('deliveries', 'raw_sent_at', 'TEXT');
}

/** Ghi DB ra file. */
export function persist(): void {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  dirty = false;
}

/** Chạy câu lệnh DDL. */
export function exec(sql: string): void {
  ensure().run(sql);
  dirty = true;
  persist();
}

function bind(params?: unknown[]): SqlValue[] {
  if (!params) return [];
  return params as SqlValue[];
}

/** Trả về 1 dòng đầu tiên (hoặc undefined). */
export function get<T = Row>(sql: string, params?: unknown[]): T | undefined {
  const stmt = ensure().prepare(sql);
  try {
    stmt.bind(bind(params) as any);
    if (stmt.step()) return stmt.getAsObject() as unknown as T;
    return undefined;
  } finally {
    stmt.free();
  }
}

/** Trả về tất cả các dòng. */
export function all<T = Row>(sql: string, params?: unknown[]): T[] {
  const stmt = ensure().prepare(sql);
  const rows: T[] = [];
  try {
    stmt.bind(bind(params) as any);
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
    return rows;
  } finally {
    stmt.free();
  }
}

/** Thực thi câu lệnh ghi (INSERT/UPDATE/DELETE). */
export function run(sql: string, params?: unknown[]): { changes: number } {
  const database = ensure();
  const stmt = database.prepare(sql);
  try {
    stmt.bind(bind(params) as any);
    stmt.step();
  } finally {
    stmt.free();
  }
  dirty = true;
  return { changes: database.getRowsModified() };
}

/** Sinh mã tuần tự dạng PREFIX + số (VD KH000001) dựa trên cột code của 1 bảng. */
export function nextCode(table: string, prefix: string): string {
  const row = get<{ n: number }>(
    `SELECT MAX(CAST(SUBSTR(code, ${prefix.length + 1}) AS INTEGER)) AS n FROM ${table} WHERE code LIKE '${prefix}%'`
  );
  const seq = (row?.n || 0) + 1;
  return prefix + String(seq).padStart(6, '0');
}

export function getDb(): SqlJsDatabase {
  return ensure();
}

/** Đọc 1 giá trị cấu hình (app_settings). */
export function getSetting(key: string): string | undefined {
  try {
    const row = get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
    return row?.value ?? undefined;
  } catch { return undefined; }
}

/** Đọc toàn bộ cấu hình theo tiền tố key (vd 'smtp.'), trả object không kèm tiền tố. */
export function getSettingsByPrefix(prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const rows = all<{ key: string; value: string }>('SELECT key, value FROM app_settings WHERE key LIKE ?', [prefix + '%']);
    for (const r of rows) out[r.key.slice(prefix.length)] = r.value ?? '';
  } catch { /* bảng chưa có */ }
  return out;
}

/** Ghi (upsert) 1 giá trị cấu hình rồi persist. */
export function setSetting(key: string, value: string, updatedBy?: string): void {
  run(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES (?,?,?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    [key, value, new Date().toISOString(), updatedBy || null]
  );
  persist();
}
