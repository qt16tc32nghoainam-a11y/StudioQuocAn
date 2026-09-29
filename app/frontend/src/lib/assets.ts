// Chuyển đường dẫn ảnh của website (dạng /assets/img/... hoặc /assets/uploads/...)
// sang URL mà app quản trị phục vụ được (/website-assets/...), để xem ảnh ngay trong app.
export function websiteImg(p?: string): string {
  if (!p) return '';
  const s = String(p).trim();
  if (/^https?:\/\//i.test(s)) return s;          // link tuyệt đối: giữ nguyên
  const clean = s.replace(/^\//, '');             // bỏ / đầu
  if (clean.startsWith('assets/')) {
    return '/website-assets/' + clean.slice('assets/'.length);
  }
  return s;
}
