import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Modal, Field, Spinner, Empty, StatusBadge, money, dateVN } from '../components/ui';
import { useAuth } from '../lib/auth';
import ShootCalendar from '../components/ShootCalendar';

interface Shoot {
  id: string; code: string; customer_id: string; customer_name?: string; customer_phone?: string;
  title?: string; package_name?: string; shoot_type?: string; location?: string; shoot_date?: string;
  photographer_id?: string; makeup_id?: string; total_amount?: number; deposit_amount?: number;
  paid_full?: number; status?: string; note?: string; due_date?: string;
  start_time?: string; end_time?: string;
}
interface Staff { id: string; full_name: string; role: string; }
interface Customer { id: string; full_name: string; code: string; }

export default function Shoots() {
  const { isSale } = useAuth();
  const [sp] = useSearchParams();
  const [list, setList] = useState<Shoot[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [opts, setOpts] = useState<{ shootStatus: string[]; shootTypes: string[] }>({ shootStatus: [], shootTypes: [] });
  // Lọc ban đầu nhận từ URL (bấm từ Dashboard sang: ?status=..., ?month=YYYY-MM).
  const [statusFilter, setStatusFilter] = useState(sp.get('status') || '');
  const [monthFilter, setMonthFilter] = useState(sp.get('month') || 'all');
  const [q, setQ] = useState(sp.get('q') || '');
  const [edit, setEdit] = useState<Partial<Shoot> | null>(null);
  const [err, setErr] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const load = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (q) params.set('q', q);
    api.get<Shoot[]>(`/shoots?${params}`).then(setList).catch(() => setList([]));
  };
  useEffect(load, [statusFilter, q]);
  // URL đổi (bấm link từ Dashboard) -> áp lại bộ lọc.
  useEffect(() => {
    setStatusFilter(sp.get('status') || '');
    setMonthFilter(sp.get('month') || 'all');
    setQ(sp.get('q') || '');
  }, [sp]);
  useEffect(() => {
    api.get<Customer[]>('/customers').then(setCustomers).catch(() => {});
    api.get<Staff[]>('/meta/staff').then(setStaff).catch(() => {});
    api.get('/meta/options').then(setOpts).catch(() => {});
  }, []);

  const openNew = () => { setEdit({ status: 'Đã đặt lịch', total_amount: 0, deposit_amount: 0 }); setErr(''); };
  // Mở form sửa từ 1 id (dùng khi bấm buổi trong chế độ Lịch) — lấy đầy đủ dữ liệu buổi.
  const openEditById = (id: string) => {
    api.get<Shoot>(`/shoots/${id}`).then((s) => { setEdit(s); setErr(''); }).catch((e: any) => alert(e.message));
  };

  const save = async (force = false) => {
    if (!edit?.customer_id) { setErr('Chọn khách hàng'); return; }
    setErr('');
    const body = force ? { ...edit, force: true } : edit;
    try {
      if (edit.id) await api.put(`/shoots/${edit.id}`, body);
      else await api.post('/shoots', body);
      setEdit(null);
      load();
    } catch (e: any) {
      // Trùng lịch nhân sự (409): hỏi xác nhận rồi lưu lại với force.
      if (e.status === 409 && e.data?.conflicts) {
        const msg = 'Cảnh báo trùng lịch:\n\n- ' + e.data.conflicts.join('\n- ') + '\n\nVẫn muốn lưu buổi này?';
        if (confirm(msg)) return save(true);
        return;
      }
      setErr(e.message);
    }
  };

  const remove = async (s: Shoot) => {
    if (!confirm(`Xóa buổi chụp ${s.code}? (Xóa cả bản ghi giao hình)`)) return;
    try { await api.del(`/shoots/${s.id}`); load(); }
    catch (e: any) { alert(e.message); }
  };

  const staffName = (id?: string) => staff.find((s) => s.id === id)?.full_name;
  const photographers = staff.filter((s) => s.role === 'Photo');
  const makeupArtists = staff.filter((s) => s.role === 'Makeup');

  // Nhóm buổi chụp theo tháng (YYYY-MM). Buổi chưa có ngày gom vào "Chưa có ngày".
  const monthKey = (s: Shoot) => (s.shoot_date ? s.shoot_date.slice(0, 7) : '');
  const monthLabel = (k: string) => { if (!k) return 'Chưa có ngày chụp'; const [y, m] = k.split('-'); return `Tháng ${parseInt(m, 10)}/${y}`; };

  const months = Array.from(new Set((list || []).map(monthKey))).sort((a, b) => (a < b ? 1 : -1)); // mới -> cũ
  const shown = (list || []).filter((s) => monthFilter === 'all' || monthKey(s) === monthFilter);
  const groups: { key: string; items: Shoot[] }[] = [];
  for (const k of Array.from(new Set(shown.map(monthKey))).sort((a, b) => (a < b ? 1 : -1))) {
    groups.push({ key: k, items: shown.filter((s) => monthKey(s) === k).sort((a, b) => ((b.shoot_date || '') < (a.shoot_date || '') ? -1 : 1)) });
  }

  return (
    <>
      <div className="page-head">
        <h1>Buổi chụp</h1>
        <div className="btn-row" style={{ alignItems: 'center' }}>
          <div className="segment" role="tablist" aria-label="Kiểu xem">
            <button role="tab" aria-selected={viewMode === 'list'} className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>Danh sách</button>
            <button role="tab" aria-selected={viewMode === 'calendar'} className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>Lịch</button>
          </div>
          {isSale && <button className="btn" onClick={openNew}>+ Thêm buổi chụp</button>}
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <ShootCalendar onOpenShoot={openEditById} reloadKey={list?.length} />
      ) : (
      <>
      <div className="toolbar">
        <input placeholder="Tìm khách / mã / tiêu đề…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="all">Tất cả tháng</option>
          {months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {opts.shootStatus.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {!list ? <Spinner /> : shown.length === 0 ? <Empty text="Không có buổi chụp phù hợp." /> : (
        <div className="grid" style={{ gap: 16 }}>
          {groups.map((g) => (
            <div key={g.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#f6efe3', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: 15, color: 'var(--gold-dark)' }}>📅 {monthLabel(g.key)}</b>
                <span className="muted" style={{ fontSize: 13 }}>{g.items.length} buổi</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Mã</th><th>Khách</th><th>Ngày chụp</th><th>Loại</th><th>Người chụp</th><th>Trang điểm</th><th>Địa điểm</th><th>Trạng thái</th><th></th></tr></thead>
                  <tbody>
                    {g.items.map((s) => (
                      <tr key={s.id}>
                        <td className="muted">{s.code}</td>
                        <td><b>{s.customer_name}</b><div className="muted" style={{ fontSize: 12.5 }}>{s.title || ''}</div></td>
                        <td>{dateVN(s.shoot_date)}{s.start_time ? <div className="muted" style={{ fontSize: 12 }}>{s.start_time}{s.end_time ? '–' + s.end_time : ''}</div> : null}</td>
                        <td className="muted">{s.shoot_type || '—'}</td>
                        <td className="muted">{staffName(s.photographer_id) || '—'}</td>
                        <td className="muted">{staffName(s.makeup_id) || '—'}</td>
                        <td className="muted">{s.location || '—'}</td>
                        <td><StatusBadge status={s.status || ''} /></td>
                        <td>
                          <div className="btn-row">
                            {isSale ? <>
                              <button className="btn btn--ghost btn--sm" onClick={() => { setEdit(s); setErr(''); }}>Sửa</button>
                              <button className="btn btn--danger btn--sm" onClick={() => remove(s)}>Xóa</button>
                            </> : <span className="muted" style={{ fontSize: 13 }}>Xem</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {edit && (
        <Modal
          title={edit.id ? `Sửa buổi chụp ${edit.code || ''}` : 'Thêm buổi chụp'}
          onClose={() => setEdit(null)}
          wide
          footer={<>
            <button className="btn btn--ghost" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn" onClick={() => save()}>Lưu</button>
          </>}
        >
          {err && <div className="msg msg--err">{err}</div>}
          <div className="hint" style={{ background: '#f6efe3', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 12px', marginBottom: 12 }}>
            📅 Màn hình này chỉ xếp <b>lịch chụp</b> và <b>phân công</b> Photo/Makeup. Gói dịch vụ và tiền do Sale nhập ở mục <b>Khách hàng</b>.
          </div>
          <div className="field-row">
            <Field label="Khách hàng *">
              <select value={edit.customer_id || ''} onChange={(e) => setEdit({ ...edit, customer_id: e.target.value })} disabled={!!edit.id}>
                <option value="">— Chọn khách —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.code})</option>)}
              </select>
            </Field>
            <Field label="Trạng thái">
              <select value={edit.status || 'Đã đặt lịch'} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                {opts.shootStatus.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Loại chụp">
              <select value={edit.shoot_type || ''} onChange={(e) => setEdit({ ...edit, shoot_type: e.target.value })}>
                <option value="">— Chọn —</option>
                {opts.shootTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Ghi chú lịch (tùy chọn)" hint="VD: Lễ dạm ngõ, chụp buổi sáng…"><input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Mô tả ngắn cho ekip" /></Field>
          </div>
          <div className="field-row">
            <Field label="Ngày chụp"><input type="date" value={edit.shoot_date?.slice(0, 10) || ''} onChange={(e) => setEdit({ ...edit, shoot_date: e.target.value })} /></Field>
            <Field label="Địa điểm"><input value={edit.location || ''} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
          </div>
          <div className="field-row">
            <Field label="Giờ bắt đầu" hint="Để trống = cả ngày"><input type="time" value={edit.start_time || ''} onChange={(e) => setEdit({ ...edit, start_time: e.target.value })} /></Field>
            <Field label="Giờ kết thúc"><input type="time" value={edit.end_time || ''} onChange={(e) => setEdit({ ...edit, end_time: e.target.value })} /></Field>
          </div>
          <div className="field-row">
            <Field label="Người chụp (Photo)">
              <select value={edit.photographer_id || ''} onChange={(e) => setEdit({ ...edit, photographer_id: e.target.value })}>
                <option value="">— Chọn —</option>
                {photographers.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </Field>
            <Field label="Trang điểm (Makeup)">
              <select value={edit.makeup_id || ''} onChange={(e) => setEdit({ ...edit, makeup_id: e.target.value })}>
                <option value="">— Chọn —</option>
                {makeupArtists.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </Field>
          </div>
          {/* Tiền & gói do Sale quản lý ở mục Khách hàng. Ở đây chỉ hiện để tham khảo, không nhập. */}
          {edit.id && isSale && (
            <div className="field-row">
              <Field label="Tổng tiền (đ)" hint="Sửa tiền/cọc trong mục Khách hàng.">
                <input type="text" value={money(edit.total_amount)} disabled />
              </Field>
              <Field label="Đã thu">
                <input type="text" value={money(edit.deposit_amount) + (edit.paid_full ? ' · Đã đủ' : '')} disabled />
              </Field>
            </div>
          )}
          {!edit.id && (
            <Field label="Ngày khách cần ảnh (hạn giao)" hint="Tạo sẵn bản ghi theo dõi giao hình.">
              <input type="date" value={edit.due_date?.slice(0, 10) || ''} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} />
            </Field>
          )}
          <Field label="Ghi chú"><textarea value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
