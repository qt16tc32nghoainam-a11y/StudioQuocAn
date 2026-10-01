import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Spinner, StatusBadge, dateVN, money } from '../components/ui';
import { useAuth } from '../lib/auth';

interface Finance {
  label: string; revenue: number; expense: number; profit: number; receivable: number;
  expenseByType: { loai: string; s: number }[];
}

function FinancePanel() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [f, setF] = useState<Finance | null>(null);
  useEffect(() => { api.get<Finance>(`/dashboard/finance?period=${period}`).then(setF).catch(() => setF(null)); }, [period]);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Tài chính {f ? `— ${f.label}` : ''}</h2>
        <div className="btn-row">
          {([['week', 'Tuần'], ['month', 'Tháng'], ['year', 'Năm']] as const).map(([k, l]) => (
            <button key={k} className={`btn btn--sm ${period === k ? '' : 'btn--ghost'}`} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
      </div>
      {!f ? <Spinner /> : (
        <>
          <div className="grid stat-grid" style={{ marginTop: 14 }}>
            <div className="card stat"><span className="n" style={{ color: 'var(--green)' }}>{money(f.revenue)}</span><span className="l">Doanh thu (đã thu)</span></div>
            <Link to="/chi-phi" className="card stat stat--link"><span className="n" style={{ color: 'var(--red)' }}>{money(f.expense)}</span><span className="l">Chi phí →</span></Link>
            <div className="card stat"><span className="n" style={{ color: f.profit >= 0 ? 'var(--gold-dark)' : 'var(--red)' }}>{money(f.profit)}</span><span className="l">Lợi nhuận</span></div>
            <div className="card stat"><span className="n" style={{ color: 'var(--amber)' }}>{money(f.receivable)}</span><span className="l">Công nợ (khách còn nợ)</span></div>
          </div>
          {f.expenseByType.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <b style={{ fontSize: 13.5, color: 'var(--muted)' }}>Chi phí theo loại:</b>
              <div className="btn-row" style={{ marginTop: 6 }}>
                {f.expenseByType.map((e) => (
                  <span key={e.loai} className="badge badge--gray">{e.loai}: {money(e.s)}đ</span>
                ))}
              </div>
            </div>
          )}
          <p className="hint" style={{ marginTop: 10 }}>Doanh thu = tiền thực thu (đặt cọc + thanh toán) trong kỳ. Lợi nhuận = doanh thu − chi phí.</p>
        </>
      )}
    </div>
  );
}

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
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const [d, setD] = useState<Dash | null>(null);

  useEffect(() => {
    api.get<Dash>('/dashboard').then(setD).catch(() => {});
  }, []);

  if (!d) return <Spinner />;

  return (
    <>
      {isAdmin && <FinancePanel />}
      <div className="grid stat-grid" style={{ marginBottom: 20 }}>
        {isAdmin && (
          <Link to="/khach-hang" className="card stat stat--link"><span className="n">{d.totalCustomers}</span><span className="l">Khách hàng →</span></Link>
        )}
        <Link to="/buoi-chup" className="card stat stat--link"><span className="n">{d.totalShoots}</span><span className="l">Buổi chụp →</span></Link>
        <Link to="/giao-hinh?filter=editing" className="card stat stat--link"><span className="n">{d.pendingEditing}</span><span className="l">Chưa làm hình →</span></Link>
        <Link to="/giao-hinh?filter=pending" className="card stat stat--link"><span className="n">{d.pendingDelivery}</span><span className="l">Chưa giao ảnh →</span></Link>
        <Link to="/giao-hinh?filter=overdue" className={`card stat stat--link${d.overdueCount ? ' alert' : ''}`}><span className="n">{d.overdueCount}</span><span className="l">Quá hạn giao →</span></Link>
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
                    <tr key={s.id} className="row-link" onClick={() => nav(`/buoi-chup?q=${encodeURIComponent(s.customer_name || s.code || '')}`)} style={{ cursor: 'pointer' }}>
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
                    <tr key={o.id} className="row-link" onClick={() => nav('/giao-hinh?filter=overdue')} style={{ cursor: 'pointer' }}>
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
              <Link key={s.status} to={`/buoi-chup?status=${encodeURIComponent(s.status)}`}
                style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }} title={`Xem buổi "${s.status}"`}>
                <StatusBadge status={s.status} /> <b>{s.n}</b>
              </Link>
            ))}
        </div>
      </div>
    </>
  );
}
