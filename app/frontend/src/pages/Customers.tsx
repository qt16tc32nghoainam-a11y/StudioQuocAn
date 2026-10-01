import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Field, Spinner, Empty, StatusBadge, money, dateVN } from '../components/ui';
import { useAuth } from '../lib/auth';

interface Customer {
  id: string; code: string; full_name: string; phone?: string; email?: string;
  address?: string; source?: string; note?: string;
}

interface BookShoot { shoot_type: string; shoot_date?: string; start_time?: string }
const EMPTY: Partial<Customer> & { shoots?: BookShoot[] } = { full_name: '', phone: '', email: '', address: '', source: '', note: '', shoots: [] };

export default function Customers() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState<Customer[] | null>(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<(Partial<Customer> & { shoots?: BookShoot[] }) | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [bookingTypes, setBookingTypes] = useState<string[]>([]);

  const load = () => {
    api.get<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(setList).catch(() => setList([]));
  };
  useEffect(load, [q]);
  useEffect(() => { api.get('/meta/options').then((o) => { setSources(o.sources || []); setBookingTypes(o.bookingTypes || []); }).catch(() => {}); }, []);

  const save = async () => {
    if (!edit?.full_name?.trim()) { setErr('Nhập tên khách hàng'); return; }
    if (!edit?.phone?.trim()) { setErr('Nhập số điện thoại (bắt buộc)'); return; }
    if (!edit?.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edit.email.trim())) {
      setErr('Nhập email khách hàng hợp lệ (bắt buộc để gửi mail hợp đồng và ảnh)'); return;
    }
    const bookings = (edit.shoots || []).filter((s) => s.shoot_type);
    if (bookings.some((s) => !s.shoot_date)) { setErr('Mỗi buổi chụp cần chọn ngày dự tính'); return; }
    setErr('');
    try {
      if (edit.id) await api.put(`/customers/${edit.id}`, edit);
      else await api.post('/customers', { ...edit, shoots: bookings });
      setEdit(null);
      load();
    } catch (e: any) { setErr(e.message); }
  };

  const remove = async (c: Customer) => {
    if (!confirm(`Xóa khách "${c.full_name}"?`)) return;
    try { await api.del(`/customers/${c.id}`); load(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <h1>Khách hàng</h1>
        {isAdmin && <button className="btn" onClick={() => { setEdit({ ...EMPTY }); setErr(''); }}>+ Thêm khách</button>}
      </div>

      <div className="toolbar">
        <input placeholder="Tìm tên, SĐT, mã khách…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
      </div>

      {!list ? <Spinner /> : list.length === 0 ? <Empty text="Chưa có khách hàng nào." /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Mã</th><th>Tên khách</th><th>SĐT</th><th>Nguồn</th><th>Địa chỉ</th><th></th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="muted">{c.code}</td>
                  <td><b>{c.full_name}</b></td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.source || '—'}</td>
                  <td className="muted">{c.address || '—'}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn--ghost btn--sm" onClick={() => setViewId(c.id)}>Xem</button>
                      {isAdmin && <>
                        <button className="btn btn--ghost btn--sm" onClick={() => { setEdit(c); setErr(''); }}>Sửa</button>
                        <button className="btn btn--danger btn--sm" onClick={() => remove(c)}>Xóa</button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <Modal
          title={edit.id ? 'Sửa khách hàng' : 'Thêm khách hàng'}
          onClose={() => setEdit(null)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn" onClick={save}>Lưu</button>
          </>}
        >
          {err && <div className="msg msg--err">{err}</div>}
          <Field label="Tên khách / cặp đôi *">
            <input value={edit.full_name || ''} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} placeholder="VD: Ngọc Quang & Kiều Phúc" />
          </Field>
          <div className="field-row">
            <Field label="Số điện thoại *" hint="Bắt buộc."><input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="09xx xxx xxx" /></Field>
            <Field label="Gmail / Email *" hint="Bắt buộc — gửi mail hợp đồng và link ảnh.">
              <input type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="email@domain.com" />
            </Field>
          </div>
          <Field label="Địa chỉ"><input value={edit.address || ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
          <Field label="Nguồn khách">
            <select value={edit.source || ''} onChange={(e) => setEdit({ ...edit, source: e.target.value })}>
              <option value="">— Chọn —</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Ghi chú"><textarea value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>

          {/* Buổi chụp khách book — chỉ khi tạo khách mới. Khách book nhiều loại thì thêm nhiều dòng. */}
          {!edit.id && (
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: 14.5 }}>Buổi chụp khách đặt</b>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEdit({ ...edit, shoots: [...(edit.shoots || []), { shoot_type: bookingTypes[0] || 'Chụp ảnh cổng', shoot_date: '' }] })}>+ Thêm buổi</button>
              </div>
              <p className="hint" style={{ margin: '2px 0 10px' }}>Khách book nhiều loại cùng lúc thì thêm nhiều dòng. Mỗi buổi sẽ tự lên Lịch làm việc + Google Calendar. (Gán người chụp / giá bổ sung sau trong mục Buổi chụp.)</p>
              {(edit.shoots || []).length === 0 && <p className="muted" style={{ fontSize: 13 }}>Chưa thêm buổi nào. Có thể để trống và tạo buổi chụp sau.</p>}
              {(edit.shoots || []).map((bk, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Loại chụp</label>
                    <select value={bk.shoot_type} onChange={(e) => { const n = [...edit.shoots!]; n[i] = { ...n[i], shoot_type: e.target.value }; setEdit({ ...edit, shoots: n }); }} style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9 }}>
                      {bookingTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 150 }}>
                    <label style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Ngày dự tính</label>
                    <input type="date" value={bk.shoot_date || ''} onChange={(e) => { const n = [...edit.shoots!]; n[i] = { ...n[i], shoot_date: e.target.value }; setEdit({ ...edit, shoots: n }); }} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 9 }} />
                  </div>
                  <div style={{ width: 110 }}>
                    <label style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Giờ (nếu có)</label>
                    <input type="time" value={bk.start_time || ''} onChange={(e) => { const n = [...edit.shoots!]; n[i] = { ...n[i], start_time: e.target.value }; setEdit({ ...edit, shoots: n }); }} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 9 }} />
                  </div>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => setEdit({ ...edit, shoots: edit.shoots!.filter((_, x) => x !== i) })}>×</button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {viewId && <CustomerDetail id={viewId} onClose={() => setViewId(null)} />}
    </>
  );
}

interface ShootRow {
  id: string; code: string; title?: string; shoot_type?: string; shoot_date?: string; status?: string;
  photographer_name?: string; makeup_name?: string; total_amount?: number; paid_amount?: number;
  due_date?: string; editing_done?: number; delivered?: number; raw_sent?: number;
}

function CustomerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<any>(undefined);
  useEffect(() => { api.get(`/customers/${id}`).then(setData).catch(() => setData(null)); }, [id]);

  return (
    <Modal title={data ? `Khách: ${data.full_name} (${data.code})` : 'Chi tiết khách'} onClose={onClose} wide>
      {data === undefined ? <Spinner /> : !data ? <Empty text="Không tải được." /> : (
        <>
          <div className="field-row">
            <div><b className="muted" style={{ fontSize: 12.5 }}>Điện thoại</b><div>{data.phone || '—'}</div></div>
            <div><b className="muted" style={{ fontSize: 12.5 }}>Email</b><div>{data.email || '—'}</div></div>
          </div>
          <div className="field-row" style={{ marginTop: 8 }}>
            <div><b className="muted" style={{ fontSize: 12.5 }}>Nguồn</b><div>{data.source || '—'}</div></div>
            <div><b className="muted" style={{ fontSize: 12.5 }}>Địa chỉ</b><div>{data.address || '—'}</div></div>
          </div>
          {data.note && <p className="muted" style={{ marginTop: 8 }}>Ghi chú: {data.note}</p>}

          <h3 style={{ margin: '18px 0 10px', fontSize: 15 }}>Buổi chụp ({data.shoots?.length || 0})</h3>
          {(!data.shoots || data.shoots.length === 0) ? <p className="muted">Chưa có buổi chụp.</p> : (
            <div className="grid" style={{ gap: 10 }}>
              {data.shoots.map((s: ShootRow) => {
                const total = Number(s.total_amount) || 0;
                const paid = Number(s.paid_amount) || 0;
                const remaining = Math.max(0, total - paid);
                return (
                  <div key={s.id} className="card" style={{ background: '#faf7f2', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <b>{s.code} — {s.shoot_type || s.title || 'Buổi chụp'}</b>
                      <StatusBadge status={s.status || ''} />
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6, marginTop: 10, fontSize: 13.5 }}>
                      <div><span className="muted">Ngày chụp: </span><b>{dateVN(s.shoot_date)}</b></div>
                      <div><span className="muted">Người chụp: </span>{s.photographer_name || '—'}</div>
                      <div><span className="muted">Trang điểm: </span>{s.makeup_name || '—'}</div>
                      <div><span className="muted">Hạn giao: </span>{dateVN(s.due_date)}</div>
                      <div><span className="muted">Tổng tiền: </span>{money(total)}</div>
                      <div><span className="muted">Đã cọc/thu: </span><b style={{ color: 'var(--green)' }}>{money(paid)}</b></div>
                      <div><span className="muted">Phần còn lại: </span><b style={{ color: remaining > 0 ? 'var(--amber)' : 'var(--green)' }}>{money(remaining)}</b></div>
                    </div>
                    <div className="btn-row" style={{ marginTop: 10 }}>
                      <span className={`badge ${s.raw_sent ? 'badge--green' : 'badge--gray'}`}>Ảnh gốc: {s.raw_sent ? 'đã gửi' : 'chưa'}</span>
                      <span className={`badge ${s.editing_done ? 'badge--green' : 'badge--amber'}`}>Làm hình: {s.editing_done ? 'xong' : 'chưa'}</span>
                      <span className={`badge ${s.delivered ? 'badge--green' : 'badge--amber'}`}>Giao ảnh: {s.delivered ? 'đã giao' : 'chưa'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
