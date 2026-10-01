import { AuthUser } from '../types';

/**
 * Vai trò "Sale" (người tư vấn/chốt khách) = Admin hoặc Makeup.
 * Sale được quản lý toàn bộ khách hàng + thu tiền. Photo chỉ xem buổi mình chụp.
 */
export function isSale(role: string): boolean {
  return role === 'Admin' || role === 'Makeup';
}

/**
 * Sinh điều kiện SQL giới hạn buổi chụp theo quyền:
 *  - Admin: xem tất cả.
 *  - Photo: chỉ buổi chụp mình là người chụp.
 *  - Makeup: chỉ buổi chụp mình là người trang điểm.
 * alias: bí danh bảng shoots trong câu SQL (vd 's').
 */
export function shootScope(user: AuthUser, alias = 's'): { clause: string; params: any[] } {
  if (user.role === 'Admin') return { clause: '', params: [] };
  if (user.role === 'Photo') return { clause: `${alias}.photographer_id = ?`, params: [user.id] };
  if (user.role === 'Makeup') return { clause: `${alias}.makeup_id = ?`, params: [user.id] };
  // phòng hờ role lạ: không thấy gì
  return { clause: '1 = 0', params: [] };
}
