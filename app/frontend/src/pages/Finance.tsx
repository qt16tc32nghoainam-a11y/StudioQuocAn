import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Spinner, Empty, money, dateVN } from '../components/ui';

type Period = 'week' | 'month' | 'year';
const PERIODS: [Period, string][] = [['week', 'Tuần'], ['month', 'Tháng'], ['year', 'Năm']];

interface ProfitRow { id: string; code: string; shoot_type?: string; shoot_date?: string; customer_name?: string; paid: number; cost: number; profit: number; }
interface ProfitData { label: string; rows: ProfitRow[]; totalRevenue: number; totalCost: number; totalProfit: number; }
interface LedgerRow { ngay: string; so_tien: number; huong: string; loai: string; shoot_code?: string; customer_name?: string; balance: number; }
interface CashData { label: string; ledger: LedgerRow[]; totalIn: number; totalOut: number; balance: number; }

export default function Finance() {
  const [tab, setTab] = useState<'profit' | 'cash'>('profit');
  const [period, setPeriod] = useState<Period>('month');
  const [profit, setProfit] = useState<ProfitData | null>(null);
  const [cash, setCash] = useState<CashData | null>(null);

  useEffect(() => {
    if (tab === 'profit') { setProfit(null); api.get<ProfitData>(`/dashboard/profit-by-shoot?period=${period}`).then(setProfit).catch(() => setProfit(null)); }
    else { setCash(null); api.get<CashData>(`/dashboard/cashbook?period=${period}`).then(setCash).catch(() => setCash(null)); }
  }, [tab, period]);

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="btn-row">
          <button className={`btn btn--sm ${tab === 'profit' ? '' : 'btn--ghost'}`} onClick={() => setTab('profit')}>Lợi nhuận theo buổi</button>
          <button className={`btn btn--sm ${tab === 'cash' ? '' : 'btn--ghost'}`} onClick={() => setTab('cash')}>Sổ quỹ</button>
        </div>
        <div className="btn-row">
          {PERIODS.map(([k, l]) => (
            <button key={k} className={`btn btn--sm ${period === k ? '' : 'btn--ghost'}`} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'profit' ? (
        !profit ? <Spinner /> : (
          <>
            <div className="grid stat-grid" style={{ marginBottom: 16 }}>
              <div className="card stat"><span className="n" style={{ color: 'var(--green)' }}>{money(profit.totalRevenue)}</span><span className="l">Đã thu ({profit.label})</span></div>
              <div className="card stat"><span className="n" style={{ color: 'var(--red)' }}>{money(profit.totalCost)}</span><span className="l">Chi phí gắn buổi</span></div>
              <div className="card stat"><span className="n" style={{ color: profit.totalProfit >= 0 ? 'var(--gold-dark)' : 'var(--red)' }}>{money(profit.totalProfit)}</span><span className="l">Lợi nhuận</span></div>
            </div>
            {profit.rows.length === 0 ? <Empty text="Chưa có buổi chụp nào trong kỳ." /> : (
              <div className="card table-wrap">
                <table>
                  <thead><tr><th>Mã</th><th>Khách</th><th>Ngày</th><th>Đã thu</th><th>Chi phí</th><th>Lợi nhuận</th></tr></thead>
                  <tbody>
                    {profit.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="muted">{r.code}</td>
                        <td><b>{r.customer_name}</b><div className="muted" style={{ fontSize: 12 }}>{r.shoot_type || ''}</div></td>
                        <td>{dateVN(r.shoot_date)}</td>
                        <td style={{ color: 'var(--green)' }}>{money(r.paid)}</td>
                        <td style={{ color: 'var(--red)' }}>{money(r.cost)}</td>
                        <td><b style={{ color: r.profit >= 0 ? 'var(--gold-dark)' : 'var(--red)' }}>{money(r.profit)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="hint" style={{ marginTop: 10 }}>Lợi nhuận mỗi buổi = tiền đã thu − chi phí gắn buổi đó. Lọc theo ngày chụp trong kỳ.</p>
          </>
        )
      ) : (
        !cash ? <Spinner /> : (
          <>
            <div className="grid stat-grid" style={{ marginBottom: 16 }}>
              <div className="card stat"><span className="n" style={{ color: 'var(--green)' }}>{money(cash.totalIn)}</span><span className="l">Tổng thu ({cash.label})</span></div>
              <div className="card stat"><span className="n" style={{ color: 'var(--red)' }}>{money(cash.totalOut)}</span><span className="l">Tổng chi</span></div>
              <div className="card stat"><span className="n" style={{ color: cash.balance >= 0 ? 'var(--gold-dark)' : 'var(--red)' }}>{money(cash.balance)}</span><span className="l">Số dư kỳ</span></div>
            </div>
            {cash.ledger.length === 0 ? <Empty text="Chưa có giao dịch nào trong kỳ." /> : (
              <div className="card table-wrap">
                <table>
                  <thead><tr><th>Ngày</th><th>Nội dung</th><th>Thu</th><th>Chi</th><th>Số dư</th></tr></thead>
                  <tbody>
                    {cash.ledger.map((e, i) => (
                      <tr key={i}>
                        <td>{dateVN(e.ngay)}</td>
                        <td style={{ fontSize: 13 }}>{e.loai}{e.shoot_code ? ` · ${e.shoot_code}` : ''}{e.customer_name ? ` · ${e.customer_name}` : ''}</td>
                        <td style={{ color: 'var(--green)' }}>{e.huong === 'Thu' ? money(e.so_tien) : ''}</td>
                        <td style={{ color: 'var(--red)' }}>{e.huong === 'Chi' ? money(e.so_tien) : ''}</td>
                        <td><b>{money(e.balance)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="hint" style={{ marginTop: 10 }}>Thu = các khoản thu tiền khách. Chi = chi phí studio. Số dư = thu − chi lũy kế theo thời gian.</p>
          </>
        )
      )}
    </>
  );
}
