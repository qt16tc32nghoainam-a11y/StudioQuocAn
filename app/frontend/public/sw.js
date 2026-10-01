/* Service worker tối giản cho PWA Quốc An Studio Admin.
   - KHÔNG cache API (/api) và dữ liệu động — luôn lấy mới từ mạng.
   - Chỉ cache app shell (HTML/JS/CSS) để mở nhanh và chạy được khi mạng chập chờn. */
const CACHE = 'qa-admin-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Không đụng vào API, upload, hay request không phải GET.
  if (req.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname.startsWith('/website-assets')) {
    return; // để trình duyệt tự xử lý (luôn lên mạng)
  }

  // App shell: network-first, fallback cache (để có bản mới nhất khi online).
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
