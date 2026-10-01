import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Spinner, StatusBadge, dateVN } from '../components/ui';
import { useAuth } from '../lib/auth';

interface Ev {
  id: string; code: string; title?: string; shoot_type?: string; shoot_date?: string;
  start_time?: string; end_time?: string; location?: string; status?: string;
  customer_name?: string; customer_phone?: string; photographer_name?: string; makeup_name?: string;
}
interface Staff { id: string; full_name: string; role: string; }

type View = 'month' | 'week' | 'day';

const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }

const STATUS_COLOR: Record<string, string> = {
  'Đã đặt lịch': '#2f6fb0', 'Đã chụp': '#c8891a', 'Đang xử lý hình': '#c8891a',
  'Chờ giao': '#c8891a', 'Hoàn tất': '#2f8a5b', 'Đã hủy': '#b0a79a',
};

export default function Calendar() {
  const { isAdmin } = useAuth();
  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffFilter, setStaffFilter] = useState('');
  const [detail, setDetail] = useState<Ev | null>(null);
  const [showGoogle, setShowGoogle] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Tính khoảng ngày cần tải theo view
  const range = useMemo(() => {
    if (view === 'day') return { from: ymd(anchor), to: ymd(anchor) };
    if (view === 'week') { const s = startOfWeek(anchor); return { from: ymd(s), to: ymd(addDays(s, 6)) }; }
    // month: phủ cả các ngày đầu/cuối tháng tràn sang tuần
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: ymd(startOfWeek(first)), to: ymd(addDays(startOfWeek(last), 6)) };
  }, [view, anchor]);

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams({ from: range.from, to: range.to });
    if (staffFilter && isAdmin) p.set('staff_id', staffFilter);
    api.get<Ev[]>(`/calendar?${p}`).then(setEvents).catch(() => setEvents([])).finally(() => setLoading(false));
  };
  useEffect(load, [range.from, range.to, staffFilter]);
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

  const title = view === 'month'
    ? `Tháng ${anchor.getMonth() + 1}/${anchor.getFullYear()}`
    : view === 'week'
      ? `Tuần ${dateVN(ymd(startOfWeek(anchor)))} – ${dateVN(ymd(addDays(startOfWeek(anchor), 6)))}`
      : dateVN(ymd(anchor));

  const move = (dir: -1 | 1) => {
    if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else setAnchor(addDays(anchor, dir * (view === 'week' ? 7 : 1)));
  };

  const color = (st?: string) => STATUS_COLOR[st || ''] || '#8a7d70';
  const todayStr = ymd(new Date());

  const EventChip = ({ e }: { e: Ev }) => (
    <button onClick={() => setDetail(e)} title={`${e.customer_name} ${e.start_time || ''}`}
      style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderLeft: `3px solid ${color(e.status)}`,
        background: '#faf7f2', borderRadius: 6, padding: '3px 6px', marginBottom: 3, fontSize: 12, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      {e.start_time ? <b>{e.start_time} </b> : ''}{e.customer_name}
    </button>
  );

  // ----- Month grid -----
  const monthCells = () => {
    const start = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const key = ymd(d);
      const inMonth = d.getMonth() === anchor.getMonth();
      const evs = byDay[key] || [];
      if (i >= 35 && cells.slice(35).every(() => true) && evs.length === 0 && !inMonth && i >= 35) { /* vẫn render đủ 6 hàng cho đều */ }
      cells.push(
        <div key={key} style={{ minHeight: 92, border: '1px solid var(--line)', padding: 4, background: inMonth ? '#fff' : '#f5f2ee', opacity: inMonth ? 1 : 0.6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: key === todayStr ? 'var(--gold-dark)' : 'var(--muted)', marginBottom: 2 }}>
            {key === todayStr ? '● ' : ''}{d.getDate()}
          </div>
          {evs.slice(0, 4).map((e) => <EventChip key={e.id} e={e} />)}
          {evs.length > 4 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>+{evs.length - 4} nữa</div>}
        </div>
      );
    }
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0 }}>
          {DOW.map((d) => <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--muted)', padding: '6px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0 }}>{cells}</div>
      </div>
    );
  };

  // ----- Week / Day: dạng danh sách theo ngày -----
  const listDays = () => {
    const days = view === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))
      : [anchor];
    return (
      <div className="grid" style={{ gap: 10 }}>
        {days.map((d) => {
          const key = ymd(d);
          const evs = byDay[key] || [];
          return (
            <div key={key} className="card" style={{ padding: 12, background: key === todayStr ? '#fbf6ec' : '#fff' }}>
              <b style={{ fontSize: 14 }}>{DOW[(d.getDay() + 6) % 7]}, {dateVN(key)}</b>
              {evs.length === 0 ? <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Không có lịch</div> : (
                <div style={{ marginTop: 8 }}>
                  {evs.map((e) => (
                    <button key={e.id} onClick={() => setDetail(e)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderLeft: `4px solid ${color(e.status)}`, background: '#faf7f2', borderRadius: 8, padding: '8px 10px', marginBottom: 6, cursor: 'pointer' }}>
                      <b>{e.start_time ? `${e.start_time}${e.end_time ? '–' + e.end_time : ''} · ` : ''}{e.customer_name}</b>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{e.shoot_type || ''} {e.location ? '· ' + e.location : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <h1>Lịch làm việc</h1>
        <div className="btn-row">
          {(['month', 'week', 'day'] as View[]).map((v) => (
            <button key={v} className={`btn btn--sm ${view === v ? '' : 'btn--ghost'}`} onClick={() => setView(v)}>
              {v === 'month' ? 'Tháng' : v === 'week' ? 'Tuần' : 'Ngày'}
            </button>
          ))}
          {isAdmin && <button className="btn btn--ghost btn--sm" onClick={() => setShowGoogle(true)}>📅 Kết nối Google Calendar</button>}
          {isAdmin && <button className="btn btn--ghost btn--sm" onClick={() => setShowImport(true)}>⬇️ Nhập lịch từ Google</button>}
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn--ghost btn--sm" onClick={() => move(-1)}>‹ Trước</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setAnchor(new Date())}>Hôm nay</button>
        <button className="btn btn--ghost btn--sm" onClick={() => move(1)}>Sau ›</button>
        <b style={{ marginLeft: 8 }}>{title}</b>
        {isAdmin && (
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} style={{ marginLeft: 'auto' }}>
            <option value="">Tất cả nhân viên</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
          </select>
        )}
      </div>

      {loading ? <Spinner /> : (
        <div className="card" style={{ padding: view === 'month' ? 10 : 0, background: view === 'month' ? '#fff' : 'transparent', border: view === 'month' ? undefined : 'none', boxShadow: view === 'month' ? undefined : 'none' }}>
          {view === 'month' ? monthCells() : listDays()}
        </div>
      )}

      {detail && (
        <Modal title={`Buổi chụp ${detail.code}`} onClose={() => setDetail(null)}>
          <table style={{ width: '100%', fontSize: 14.5 }}>
            <tbody>
              <tr><td style={{ color: 'var(--muted)', padding: '6px 0', width: 120 }}>Khách</td><td><b>{detail.customer_name}</b></td></tr>
              <tr><td style={{ color: 'var(--muted)', padding: '6px 0' }}>Ngày</td><td>{dateVN(detail.shoot_date)}</td></tr>
              <tr><td style={{ color: 'var(--muted)', padding: '6px 0' }}>Giờ</td><td>{detail.start_time ? `${detail.start_time}${detail.end_time ? ' – ' + detail.end_time : ''}` : '(cả ngày)'}</td></tr>
              <tr><td style={{ color: 'var(--muted)', padding: '6px 0' }}>Loại</td><td>{detail.shoot_type || '—'}</td></tr>
              <tr><td style={{ color: 'var(--muted)', padding: '6px 0' }}>Địa điểm</td><td>{detail.location || '—'}</td></tr>
              <tr><td style={{ color: 'var(--muted)', padding: '6px 0' }}>Người chụp</td><td>{detail.photographer_name || '—'}</td></tr>
              <tr><td style={{ color: 'var(--muted)', padding: '6px 0' }}>Trang điểm</td><td>{detail.makeup_name || '—'}</td></tr>
              <tr><td style={{ color: 'var(--muted)', padding: '6px 0' }}>Trạng thái</td><td><StatusBadge status={detail.status || ''} /></td></tr>
              {isAdmin && detail.customer_phone && <tr><td style={{ color: 'var(--muted)', padding: '6px 0' }}>SĐT khách</td><td>{detail.customer_phone}</td></tr>}
            </tbody>
          </table>
          <div style={{ marginTop: 14 }}>
            <a className="btn btn--ghost btn--sm" href={googleEventUrl(detail)} target="_blank" rel="noopener">📅 Thêm vào Google Calendar</a>
          </div>
        </Modal>
      )}

      {showGoogle && <GoogleConnect onClose={() => setShowGoogle(false)} />}
      {showImport && <ImportIcs onClose={() => setShowImport(false)} onDone={load} />}
    </>
  );
}

function ImportIcs({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const doImport = async () => {
    if (!file) { setMsg({ ok: false, text: 'Chọn file .ics đã export từ Google' }); return; }
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('wa-token');
      const res = await fetch('/api/import/ics', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi nhập');
      setMsg({ ok: true, text: data.message });
      onDone();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Nhập lịch từ Google Calendar" onClose={onClose} wide>
      <div className="guide" style={{ marginBottom: 14 }}>
        <span className="guide__ic">💡</span>
        <span>Nhập 1 lần toàn bộ sự kiện cũ từ Google vào app. Sau đó quản lý trong app, không cần Google nữa.</span>
      </div>
      <b style={{ fontSize: 14 }}>Bước 1 — Export từ Google Calendar (trên máy tính):</b>
      <ol style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 20, marginTop: 6 }}>
        <li>Mở <a href="https://calendar.google.com/calendar/r/settings/export" target="_blank" rel="noopener">Google Calendar → Cài đặt → Nhập &amp; xuất</a></li>
        <li>Bấm <b>Xuất (Export)</b> → tải về file <b>.zip</b></li>
        <li>Giải nén file .zip → bên trong có (các) file <b>.ics</b></li>
      </ol>
      <b style={{ fontSize: 14 }}>Bước 2 — Tải file .ics lên đây:</b>
      <div style={{ margin: '8px 0 12px' }}>
        <input type="file" accept=".ics,text/calendar" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      {msg && <div className={`msg ${msg.ok ? 'msg--ok' : 'msg--err'}`}>{msg.text}</div>}
      <p className="hint">Các sự kiện sẽ vào khách tạm <b>"Nhập từ Google Calendar"</b>. Mở mục Khách hàng để xem và tách sang khách thật. Nhập lại cùng file sẽ không bị trùng.</p>
      <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn--ghost" onClick={onClose}>Đóng</button>
        <button className="btn" onClick={doImport} disabled={busy || !file}>{busy ? 'Đang nhập…' : 'Nhập vào app'}</button>
      </div>
    </Modal>
  );
}

/** Tạo link "Thêm nhanh 1 sự kiện" vào Google Calendar. */
function googleEventUrl(e: Ev): string {
  const d = (e.shoot_date || '').slice(0, 10).replace(/-/g, '');
  let dates = '';
  if (d && e.start_time) {
    const st = e.start_time.replace(':', '') + '00';
    const et = (e.end_time || e.start_time).replace(':', '') + '00';
    dates = `${d}T${st}/${d}T${et}`;
  } else if (d) {
    const next = new Date(Date.parse((e.shoot_date || '').slice(0, 10)) + 86400000);
    const nd = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
    dates = `${d}/${nd}`;
  }
  const text = `${e.customer_name || ''}${e.shoot_type ? ' - ' + e.shoot_type : ''}`;
  const details = [`Mã: ${e.code}`, e.photographer_name ? `Chụp: ${e.photographer_name}` : '', e.makeup_name ? `Makeup: ${e.makeup_name}` : ''].filter(Boolean).join('\n');
  const p = new URLSearchParams({ action: 'TEMPLATE', text, dates, details, location: e.location || '' });
  return `https://calendar.google.com/calendar/render?${p}`;
}

function GoogleConnect({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.get<{ url: string }>('/calendar/my-feed-url').then((r) => setUrl(absUrl(r.url))).catch(() => {}); }, []);
  const absUrl = (u: string) => (u.startsWith('http') ? u : window.location.origin + u);

  const reset = async () => {
    if (!confirm('Đổi link sẽ làm link cũ ngừng hoạt động. Tiếp tục?')) return;
    const r = await api.post<{ url: string }>('/calendar/reset-token');
    setUrl(absUrl(r.url)); setCopied(false);
  };
  const copy = () => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); };

  return (
    <Modal title="Kết nối Google Calendar" onClose={onClose} wide>
      <div className="guide" style={{ marginBottom: 14 }}>
        <span className="guide__ic">💡</span>
        <span>Thêm link dưới đây vào Google Calendar 1 lần, lịch chụp của bạn sẽ tự hiện và tự cập nhật (Google làm mới vài giờ/lần).</span>
      </div>

      <label style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>Link lịch của bạn (giữ bí mật)</label>
      <div style={{ display: 'flex', gap: 8, margin: '6px 0 14px' }}>
        <input value={url} readOnly style={{ flex: 1, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, fontSize: 13 }} onFocus={(e) => e.currentTarget.select()} />
        <button className="btn btn--sm" onClick={copy}>{copied ? '✓ Đã chép' : 'Chép link'}</button>
      </div>

      <b style={{ fontSize: 14 }}>Cách thêm vào Google Calendar (trên máy tính):</b>
      <ol style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 20, marginTop: 6 }}>
        <li>Mở <a href="https://calendar.google.com" target="_blank" rel="noopener">calendar.google.com</a></li>
        <li>Bên trái, cạnh <b>"Lịch khác" (Other calendars)</b> → bấm dấu <b>+</b> → chọn <b>"Từ URL" (From URL)</b></li>
        <li>Dán link ở trên vào → bấm <b>Thêm lịch (Add calendar)</b></li>
        <li>Xong! Lịch chụp sẽ hiện trong Google Calendar (cả trên điện thoại nếu dùng cùng tài khoản).</li>
      </ol>

      <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <button className="btn btn--ghost btn--sm" onClick={reset}>Đổi link (nếu bị lộ)</button>
        <p className="hint" style={{ marginTop: 6 }}>Lưu ý: link này riêng của bạn — Admin thấy tất cả lịch, nhân viên chỉ thấy lịch được gán. Đừng chia sẻ cho người ngoài.</p>
      </div>
    </Modal>
  );
}
