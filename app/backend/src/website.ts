/**
 * Dịch vụ đồng bộ với repo website tĩnh (website-Wedding).
 *
 * Ý tưởng: backend giữ một bản sao (clone) của repo website trong data/website-repo.
 * - Đọc nội dung: đọc file data/*.json trong bản sao đó.
 * - Sửa nội dung: ghi đè file JSON trong bản sao (chưa công bố).
 * - Công bố: commit các thay đổi rồi push lên GitHub → Netlify tự build lại website.
 *
 * Dùng simple-git. Xác thực push bằng GITHUB_TOKEN nhúng vào URL HTTPS (không cần SSH key).
 * Nếu chưa cấu hình repo/token, các hàm đọc/ghi vẫn hoạt động trên thư mục cục bộ,
 * chỉ riêng thao tác push sẽ báo lỗi rõ ràng để người vận hành biết cần cấu hình .env.
 */
import fs from 'fs';
import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { config } from './config';

// 8 file nội dung khớp với build_site.py của website
export const CONTENT_FILES = [
  'bang-gia.json',
  'bo-suu-tap.json',
  'doi-ngu.json',
  'danh-gia.json',
  'tuyen-dung.json',
  'banner.json',
  'nhac-nen.json',
  'lien-he.json',
] as const;
export type ContentFile = typeof CONTENT_FILES[number];

const repoDir = config.website.repoDir;

function dataDirInRepo(): string {
  return path.join(repoDir, config.website.dataSubdir);
}
function uploadsDirInRepo(): string {
  return path.join(repoDir, config.website.uploadsSubdir);
}

/** URL push có nhúng token (nếu có token). */
function authRemoteUrl(): string {
  const url = config.website.repoUrl;
  const token = config.website.githubToken;
  if (!url) return '';
  if (token && url.startsWith('https://')) {
    // https://github.com/owner/repo.git -> https://x-access-token:TOKEN@github.com/owner/repo.git
    return url.replace('https://', `https://x-access-token:${token}@`);
  }
  return url;
}

let git: SimpleGit | null = null;
let readyPromise: Promise<void> | null = null;

/** Đảm bảo có bản sao repo website sẵn sàng (clone lần đầu, hoặc dùng lại).
 *  Dùng chung 1 promise để nhiều lời gọi đồng thời không clone chồng lên nhau (tránh race). */
export function ensureRepo(): Promise<void> {
  if (!readyPromise) readyPromise = doEnsureRepo().catch((e) => {
    readyPromise = null; // cho phép thử lại lần sau nếu lỗi (vd mất mạng giữa chừng)
    throw e;
  });
  return readyPromise;
}

async function doEnsureRepo(): Promise<void> {
  const url = config.website.repoUrl;

  // Đã có bản sao hợp lệ (có .git và đã checkout thư mục data) -> dùng lại.
  if (fs.existsSync(path.join(repoDir, '.git'))) {
    // Nếu working tree chưa được checkout (clone dở dang trước đó) thì checkout lại.
    if (!fs.existsSync(dataDirInRepo())) {
      const g = simpleGit(repoDir);
      try { await g.checkout(['-f', config.website.branch]); } catch { /* ignore */ }
    }
    git = simpleGit(repoDir);
    await configureIdentity();
    return;
  }

  if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir, { recursive: true });

  if (url) {
    const remote = authRemoteUrl();
    const tmp = simpleGit();
    await tmp.clone(remote, repoDir, ['--branch', config.website.branch, '--single-branch']);
    git = simpleGit(repoDir);
    await configureIdentity();
  } else {
    // Không cấu hình repo: khởi tạo git cục bộ để vẫn đọc/ghi cục bộ được.
    git = simpleGit(repoDir);
    await git.init();
    if (!fs.existsSync(dataDirInRepo())) fs.mkdirSync(dataDirInRepo(), { recursive: true });
    await configureIdentity();
  }
}

async function configureIdentity(): Promise<void> {
  if (!git) return;
  await git.addConfig('user.name', config.website.authorName);
  await git.addConfig('user.email', config.website.authorEmail);
}

/** Kéo bản mới nhất từ GitHub (đề phòng có người sửa trực tiếp trên /admin). */
export async function pullLatest(): Promise<void> {
  await ensureRepo();
  if (!git || !config.website.repoUrl) return;
  try {
    await git.fetch();
    await git.reset(['--hard', `origin/${config.website.branch}`]);
  } catch (e) {
    // Bỏ qua lỗi mạng khi đọc — vẫn dùng bản cục bộ.
    console.warn('[website] Không kéo được bản mới:', (e as Error).message);
  }
}

/** Đọc 1 file nội dung, trả về object đã parse (hoặc giá trị mặc định nếu chưa có file). */
export async function readContent(file: ContentFile): Promise<any> {
  await ensureRepo();
  const p = path.join(dataDirInRepo(), file);
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf-8');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`File ${file} không phải JSON hợp lệ`);
  }
}

/** Ghi 1 file nội dung (chưa công bố — chỉ lưu vào bản sao cục bộ). */
export async function writeContent(file: ContentFile, data: any): Promise<void> {
  await ensureRepo();
  const dir = dataDirInRepo();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n', 'utf-8');
}

/** Lưu 1 ảnh upload vào thư mục assets/uploads của repo website. Trả về đường dẫn web (/assets/uploads/...). */
export async function saveUpload(filename: string, buffer: Buffer): Promise<string> {
  await ensureRepo();
  const dir = uploadsDirInRepo();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // tránh trùng tên: thêm timestamp
  const ext = path.extname(filename) || '.jpg';
  const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60) || 'anh';
  const safe = `${base}-${Date.now()}${ext.toLowerCase()}`;
  fs.writeFileSync(path.join(dir, safe), buffer);
  return `/${config.website.uploadsSubdir}/${safe}`;
}

export interface PublishResult {
  changed: string[];      // file thay đổi
  commitHash: string | null;
  pushed: boolean;
  message: string;
}

/**
 * Công bố: add + commit toàn bộ thay đổi trong repo website rồi push lên GitHub.
 * Trả về danh sách file thay đổi và mã commit.
 */
export async function publish(message: string): Promise<PublishResult> {
  await ensureRepo();
  if (!git) throw new Error('Chưa khởi tạo repo website');

  const status = await git.status();
  const changed = [...status.modified, ...status.not_added, ...status.created, ...status.deleted];
  if (changed.length === 0) {
    return { changed: [], commitHash: null, pushed: false, message: 'Không có thay đổi để công bố' };
  }

  await git.add('.');
  const commit = await git.commit(message || 'Cập nhật nội dung website');
  const commitHash = commit.commit || null;

  let pushed = false;
  if (config.website.repoUrl && config.website.githubToken) {
    const remote = authRemoteUrl();
    // đặt remote origin theo URL có token rồi push
    try {
      await git.remote(['set-url', 'origin', remote]);
    } catch {
      await git.addRemote('origin', remote);
    }
    await git.push('origin', config.website.branch);
    pushed = true;
  }

  return {
    changed,
    commitHash,
    pushed,
    message: pushed
      ? 'Đã công bố và đẩy lên GitHub. Website sẽ tự cập nhật sau khoảng 1 phút.'
      : 'Đã lưu (commit) cục bộ. Chưa cấu hình GitHub token nên chưa đẩy lên website thật.',
  };
}

/** Trạng thái repo: đã cấu hình chưa, có thay đổi chưa công bố không. */
export async function repoStatus(): Promise<{
  configured: boolean;
  hasToken: boolean;
  repoUrl: string;
  branch: string;
  pendingChanges: string[];
}> {
  await ensureRepo();
  let pending: string[] = [];
  if (git) {
    const status = await git.status();
    pending = [...status.modified, ...status.not_added, ...status.created, ...status.deleted];
  }
  return {
    configured: !!config.website.repoUrl,
    hasToken: !!config.website.githubToken,
    repoUrl: config.website.repoUrl,
    branch: config.website.branch,
    pendingChanges: pending,
  };
}
