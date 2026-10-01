import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Spinner, StatusBadge, dateVN } from './ui';
import { useAuth } from '../lib/auth';

interface Ev {
  id: string; code: string; title?: string; shoot_type?: string; shoot_date?: string;
  start_time?: string; end_time?: string; location?: string; status?: string;
  customer_name?: string; customer_phone?: string; photographer_name?: string; makeup_name?: string;
}
interface Staff { id: string; full_name: string; role: string; }

const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function startOfWeek(d: Date) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }

const STATUS_COLOR: Record<string, string> = {
  'Đã đặt lịch': '#2f6fb0', 'Đã chụp': '#b5790f', 'Đang xử lý hình': '#b5790f',
  'Chờ giao': '#b5790f', 'Hoàn tất': '#2f8a5b', 'Đã hủy': '#b0a79a',
};
const color = (st?: string) => STATUS_COLOR[st || ''] || '#8a8178';

/**
 * Lịch tháng kiểu Google cho Buổi chụp.
 * Bấm 1 ngày -> panel chi tiết các buổi ngày đó; bấm 1 buổi -> onOpenShoot(id) để mở form sửa.
 */
export default function ShootCalendar({ onOpenShoot, reloadKey }: { onOpenShoot: (id: string) => void; reloadKey?: number }) {
  const { isAdmin } = useAuth();
  const [anchor, setAnchor] = useState(new Date());
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffFilter, setStaffFilter] = useState('');
  const [selected, setSelected] = useState<string>(ymd(new Date())); // ngày đang chọn

  const range = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: ymd(startOfWeek(first)), to: ymd(addDays(startOfWeek(last), 6)) };
  }, [anchor]);

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams({ from: range.from, to: range.to });
    if (staffFilter && isAdmin) p.set('staff_id', staffFilter);
    api.get<Ev[]>(`/calendar?${p}`).then(setEvents).catch(() => setEvents([])).finally(() => setLoading(false));
  };
  useEffect(load, [range.from, range.to, staffFilter, reloadKey]);
  useEffect(() => { if (isAdmin) api.get<Staff[]>('/meta/staff').then(setStaff).catch(() => {}); }, [isAdmin]);

  const byDay = useMemo(() => {
    const m: Record<string, Ev[]> = {};
    for (const e of events) {
      const k = (e.shoot_date || '').slice(0, 10);
      if (!k) continue;
      (m[k] = m[k] || []).push(e);
    }
    for (const k in m) m[k].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    return m;
  }, [events]);

  const todayStr = ymd(new Date());
  const selectedEvs = byDay[selected] || [];

  const cells = () => {
    const start = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const out = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const key = ymd(d);
      const inMonth = d.getMonth() === anchor.getMonth();
      const evs = byDay[key] || [];
      const isToday = key === todayStr;
      const isSel = key === selected;
      out.push(
        <button key={key} className={`cal-cell${inMonth ? '' : ' cal-cell--out'}${isSel ? ' cal-cell--sel' : ''}`} onClick={() => setSelected(key)}>
          <span className={`cal-cell__num${isToday ? ' cal-cell__num--today' : ''}`}>{d.getDate()}</span>
          <span className="cal-cell__dots">
            {evs.slice(0, 4).map((e) => <span key={e.id} className="cal-dot" style={{ background: color(e.status) }} />)}
          </span>
          {evs.length > 0 && <span className="cal-cell__count">{evs.length}</span>}
        </button>
      );
    }
    return out;
  };

  return (
    <div className="cal-layout">
      {/* Lịch tháng */}
      <div className="card" style={{ padding: 14 }}>
        <div className="cal-head">
          <div className="btn-row">
            <button className="btn btn--ghost btn--sm" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>‹</button>
            <button className="btn btn--ghost btn--sm" onClick={() => { const t = new Date(); setAnchor(t); setSelected(ymd(t)); }}>Hôm nay</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>›</button>
          </div>
          <b className="cal-title">Tháng {anchor.getMonth() + 1}/{anchor.getFullYear()}</b>
          {isAdmin && (
            <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="">Tất cả nhân viên</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          )}
        </div>
        {loading ? <Spinner /> : (
          <>
            <div className="cal-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
            <div className="cal-grid">{cells()}</div>
          </>
        )}
      </div>

      {/* Chi tiết ngày đang chọn */}
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{dateVN(selected)}</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{selectedEvs.length} buổi chụp</p>
        {selectedEvs.length === 0 ? (
          <div className="empty" style={{ padding: '28px 10px' }}>Không có buổi chụp ngày này.</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {selectedEvs.map((e) => (
              <button key={e.id} className="cal-ev" onClick={() => onOpenShoot(e.id)} style={{ borderLeftColor: color(e.status) }}>
                <div className="cal-ev__top">
                  <b>{e.start_time ? `${e.start_time}${e.end_time ? '–' + e.end_time : ''}` : 'Cả ngày'}</b>
                  <StatusBadge status={e.status || ''} />
                </div>
                <div className="cal-ev__name">{e.customer_name}</div>
                <div className="cal-ev__meta">{e.shoot_type || ''}{e.location ? ' · ' + e.location : ''}</div>
                {(e.photographer_name || e.makeup_name) && (
                  <div className="cal-ev__meta">
                    {e.photographer_name ? `📷 ${e.photographer_name}` : ''}{e.makeup_name ? `  💄 ${e.makeup_name}` : ''}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
