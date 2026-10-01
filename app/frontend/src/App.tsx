import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Shoots from './pages/Shoots';
import Deliveries from './pages/Deliveries';
import Content from './pages/Content';
import Users from './pages/Users';
import Expenses from './pages/Expenses';
import EmailSettings from './pages/EmailSettings';
import Packages from './pages/Packages';
import Finance from './pages/Finance';
import ChangePassword from './pages/ChangePassword';

export default function App() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div className="spinner" style={{ marginTop: 80 }}>Đang tải…</div>;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/khach-hang" element={<Customers />} />
        <Route path="/buoi-chup" element={<Shoots />} />
        {/* Lịch làm việc tạm ẩn — chuyển sang chế độ Lịch trong Buổi chụp */}
        <Route path="/lich" element={<Navigate to="/buoi-chup" />} />
        <Route path="/giao-hinh" element={<Deliveries />} />
        <Route path="/chi-phi" element={isAdmin ? <Expenses /> : <Navigate to="/" />} />
        <Route path="/tai-chinh" element={isAdmin ? <Finance /> : <Navigate to="/" />} />
        <Route path="/goi-dich-vu" element={isAdmin ? <Packages /> : <Navigate to="/" />} />
        <Route path="/cau-hinh-email" element={isAdmin ? <EmailSettings /> : <Navigate to="/" />} />
        <Route path="/noi-dung" element={isAdmin ? <Content /> : <Navigate to="/" />} />
        <Route path="/nguoi-dung" element={isAdmin ? <Users /> : <Navigate to="/" />} />
        <Route path="/doi-mat-khau" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
