import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const NAV = [
  { to: '/', label: 'Tổng quan', ic: '📊', exact: true },
  { to: '/khach-hang', label: 'Khách hàng', ic: '👤' },
  { to: '/lich', label: 'Lịch làm việc', ic: '🗓️' },
  { to: '/buoi-chup', label: 'Buổi chụp', ic: '📅' },
  { to: '/giao-hinh', label: 'Giao hình', ic: '🖼️' },
  { to: '/chi-phi', label: 'Chi phí', ic: '💸', adminOnly: true },
  { to: '/noi-dung', label: 'Nội dung website', ic: '🌐', adminOnly: true },
  { to: '/nguoi-dung', label: 'Người dùng', ic: '🔑', adminOnly: true },
  { to: '/cau-hinh-email', label: 'Cấu hình email', ic: '✉️', adminOnly: true },
];

const TITLES: Record<string, string> = {
  '/': 'Tổng quan',
  '/khach-hang': 'Khách hàng',
  '/lich': 'Lịch làm việc',
  '/buoi-chup': 'Buổi chụp',
  '/giao-hinh': 'Theo dõi giao hình',
  '/chi-phi': 'Chi phí',
  '/noi-dung': 'Nội dung website',
  '/nguoi-dung': 'Quản lý người dùng',
  '/cau-hinh-email': 'Cấu hình email',
  '/doi-mat-khau': 'Đổi mật khẩu',
};

const ROLE_LABEL: Record<string, string> = { Admin: 'Quản trị viên', Makeup: 'Nhân viên Makeup', Photo: 'Nhân viên Photo' };

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const title = TITLES[loc.pathname] || 'Quản trị';

  return (
    <div className="app">
      {open && <div className="overlay" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar__brand">
          <b>QUỐC AN STUDIO</b>
          <span>Bảng điều khiển</span>
        </div>
        <nav className="sidebar__nav" onClick={() => setOpen(false)}>
          {NAV.filter((n) => !n.adminOnly || isAdmin).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.exact} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ic">{n.ic}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          <div className="u">{user?.full_name}</div>
          <div className="r">{ROLE_LABEL[user?.role || ''] || user?.role}</div>
          <NavLink to="/doi-mat-khau" style={{ display: 'block', marginTop: 8, color: '#d6cbbb', fontSize: 13 }}>
            Đổi mật khẩu
          </NavLink>
          <button onClick={logout}>Đăng xuất</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="burger" onClick={() => setOpen(true)}>☰</button>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
