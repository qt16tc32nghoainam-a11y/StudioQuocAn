import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Spinner, StatusBadge, dateVN } from '../components/ui';

interface Dash {
  totalCustomers: number;
  totalShoots: number;
  pendingEditing: number;
  pendingDelivery: number;
  overdueCount: number;
  upcomingShoots: any[];
  overdue: any[];
  statusBreakdown: { status: string; n: number }[];
}

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);

  useEffect(() => {
    api.get<Dash>('/dashboard').then(setD).catch(() => {});
  }, []);

  if (!d) return <Spinner />;

  return (
    <>
      <div className="grid stat-grid" style={{ marginBottom: 20 }}>
        <div className="card stat"><span className="n">{d.totalCustomers}</span><span className="l">Khách hàng</span></div>
        <div className="card stat"><span className="n">{d.totalShoots}</span><span className="l">Buổi chụp</span></div>
        <div className="card stat"><span className="n">{d.pendingEditing}</span><span className="l">Chưa làm hình</span></div>
        <div className="card stat"><span className="n">{d.pendingDelivery}</span><span className="l">Chưa giao ảnh</span></div>
        <div className={`card stat${d.overdueCount ? ' alert' : ''}`}><span className="n">{d.overdueCount}</span><span className="l">Quá hạn giao</span></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div className="card">
          <h2>Buổi chụp sắp tới</h2>
          {d.upcomingShoots.length === 0 ? (
            <p className="muted">Chưa có lịch chụp nào.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Ngày</th><th>Khách</th><th>Loại</th></tr></thead>
                <tbody>
                  {d.upcomingShoots.map((s) => (
                    <tr key={s.id}>
                      <td>{dateVN(s.shoot_date)}</td>
                      <td>{s.customer_name}</td>
                      <td className="muted">{s.shoot_type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 12 }}><Link to="/buoi-chup" className="btn btn--ghost btn--sm">Xem tất cả buổi chụp</Link></div>
        </div>

        <div className="card">
          <h2>Giao hình quá hạn</h2>
          {d.overdue.length === 0 ? (
            <p className="muted">Không có bản giao nào quá hạn. 🎉</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Hạn</th><th>Mã</th><th>Khách</th></tr></thead>
                <tbody>
                  {d.overdue.map((o) => (
                    <tr key={o.id}>
                      <td style={{ color: 'var(--red)' }}>{dateVN(o.due_date)}</td>
                      <td>{o.shoot_code}</td>
                      <td>{o.customer_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 12 }}><Link to="/giao-hinh" className="btn btn--ghost btn--sm">Xem theo dõi giao hình</Link></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Buổi chụp theo trạng thái</h2>
        <div className="btn-row">
          {d.statusBreakdown.length === 0 ? <span className="muted">Chưa có dữ liệu.</span> :
            d.statusBreakdown.map((s) => (
              <span key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StatusBadge status={s.status} /> <b>{s.n}</b>
              </span>
            ))}
        </div>
      </div>
    </>
  );
}
