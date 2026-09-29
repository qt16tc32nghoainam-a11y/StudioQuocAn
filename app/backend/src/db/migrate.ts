/**
 * Chạy migration: khởi tạo DB + áp dụng schema.
 *   npm run migrate
 */
import { initDb, persist } from './database';

async function main() {
  await initDb();
  persist();
  console.log('✓ Đã khởi tạo / cập nhật schema database.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Lỗi migrate:', e);
  process.exit(1);
});
