import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Modal, Field, Spinner, Empty, StatusBadge, money, dateVN } from '../components/ui';
import { useAuth } from '../lib/auth';
import PaymentsModal from '../components/PaymentsModal';

interface Customer {
  id: string; code: string; full_name: string; phone?: string; email?: string;
  address?: string; source?: string; note?: string;
}

interface BookShoot { shoot_type: string; shoot_date?: string; start_time?: string; package_name?: string; total_amount?: number; deposit_amount?: number; paid_full?: boolean }
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
  const [packages, setPackages] = useState<string[]>([]);

  const load = () => {
    api.get<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(setList).catch(() => setList([]));
  };
  useEffect(load, [q]);
  useEffect(() => { api.get('/meta/options').then((o) => { setSources(o.sources || []); setBookingTypes(o.bookingTypes || []); setPackages(o.packages || []); }).catch(() => {}); }, []);

  const save = async () => {
    if (!edit?.full_name?.trim()) { setErr('Nhập tên khách hàng'); return; }
    if (!edit?.phone?.trim()) { setErr('Nhập số điện thoại (bắt buộc)'); return; }
    if (!edit?.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edit.email.trim())) {
      setErr('Nhập email khách hàng hợp lệ (bắt buộc để gửi mail hợp đồng và ảnh)'); return;
    }
    const bookings = (edit.shoots || []).filter((s) => s.shoot_type);
    if (bookings.some((s) => !s.shoot_date)) { setErr('Mỗi buổi chụp cần chọn ngày dự tính'); return; }
    if (bookings.some((s) => !s.paid_full && Number(s.deposit_amount) > 0 && Number(s.total_amount) > 0 && Number(s.deposit_amount) > Number(s.total_amount))) {
      setErr('Tiền cọc không được lớn hơn tổng tiền'); return;
    }
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
              {(edit.shoots || []).map((bk, i) => {
                const upd = (patch: Partial<BookShoot>) => { const n = [...edit.shoots!]; n[i] = { ...n[i], ...patch }; setEdit({ ...edit, shoots: n }); };
                const total = Number(bk.total_amount) || 0;
                const dep = bk.paid_full ? total : (Number(bk.deposit_amount) || 0);
                const remain = Math.max(0, total - dep);
                return (
                <div key={i} className="card" style={{ background: '#faf7f2', padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <b style={{ fontSize: 13.5, color: 'var(--gold-dark)' }}>Buổi {i + 1}</b>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => setEdit({ ...edit, shoots: edit.shoots!.filter((_, x) => x !== i) })}>× Xóa buổi</button>
                  </div>
                  <div className="field-row">
                    <Field label="Loại chụp">
                      <select value={bk.shoot_type} onChange={(e) => upd({ shoot_type: e.target.value })}>
                        {bookingTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="Gói dịch vụ">
                      <input list={`pkg-${i}`} value={bk.package_name || ''} onChange={(e) => upd({ package_name: e.target.value })} placeholder="Chọn hoặc nhập gói" />
                      <datalist id={`pkg-${i}`}>{packages.map((p) => <option key={p} value={p} />)}</datalist>
                    </Field>
                  </div>
                  <div className="field-row">
                    <Field label="Ngày dự tính">
                      <input type="date" value={bk.shoot_date || ''} onChange={(e) => upd({ shoot_date: e.target.value })} />
                    </Field>
                    <Field label="Giờ (nếu có)">
                      <input type="time" value={bk.start_time || ''} onChange={(e) => upd({ start_time: e.target.value })} />
                    </Field>
                  </div>
                  <div className="field-row">
                    <Field label="Tổng tiền (đ)">
                      <input type="number" value={bk.total_amount ?? 0} onChange={(e) => upd({ total_amount: Number(e.target.value) })} />
                    </Field>
                    <Field label="Đã cọc (đ)" hint={bk.paid_full ? 'Đã tick thu đủ — bỏ qua ô này.' : (total > 0 ? `Còn lại: ${money(remain)}` : undefined)}>
                      <input type="number" value={bk.deposit_amount ?? 0} disabled={!!bk.paid_full} onChange={(e) => upd({ deposit_amount: Number(e.target.value) })} />
                    </Field>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, marginTop: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!bk.paid_full} onChange={(e) => upd({ paid_full: e.target.checked })} />
                    Khách đã thanh toán đủ
                  </label>
                </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {viewId && <CustomerDetail id={viewId} onClose={() => setViewId(null)} />}
    </>
  );
}

interface ShootRow {
  id: string; code: string; title?: string; shoot_type?: string; shoot_date?: string; status?: string; note?: string;
  photographer_name?: string; makeup_name?: string; total_amount?: number; paid_amount?: number;
  due_date?: string; editing_done?: number; delivered?: number; raw_sent?: number;
}

/** Đoán tên khách gợi ý từ title + note (vd "Chụp cổng" + "Mô tả: hoang nam - bé thảo 6h"). */
function guessName(s: ShootRow): string {
  const note = s.note || '';
  const m = note.match(/Mô tả:\s*(.+)$/);
  let text = m ? m[1] : '';
  // bỏ các cụm giờ "6h", "17h", số lượng "2 cổng"
  text = text.replace(/\b\d+\s*h\b/gi, '').replace(/\(|\)/g, ' ').trim();
  return text.slice(0, 80);
}

function CustomerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState<any>(undefined);
  const [pay, setPay] = useState<ShootRow | null>(null);
  const [reassign, setReassign] = useState<ShootRow | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<{ id: string; full_name: string; code: string }[]>([]);
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [targetId, setTargetId] = useState('');

  const reload = () => api.get(`/customers/${id}`).then(setData).catch(() => setData(null));
  useEffect(() => { reload(); }, [id]);
  useEffect(() => { api.get<any[]>('/customers').then((cs) => setExisting(cs.filter((c) => c.id !== id))).catch(() => {}); }, [id]);

  const openReassign = (s: ShootRow) => { setReassign(s); setNewName(guessName(s)); setTargetMode('new'); setTargetId(''); };
  const doReassign = async () => {
    if (!reassign) return;
    setBusy(true);
    try {
      if (targetMode === 'existing') {
        if (!targetId) { alert('Chọn khách'); setBusy(false); return; }
        await api.post(`/shoots/${reassign.id}/reassign`, { customer_id: targetId });
      } else {
        if (!newName.trim()) { alert('Nhập tên khách'); setBusy(false); return; }
        await api.post(`/shoots/${reassign.id}/reassign`, { new_customer: { full_name: newName.trim() } });
      }
      setReassign(null); reload();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

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
                    {s.note && s.note.includes('Mô tả:') && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>📝 {s.note.replace('Nhập từ Google Calendar — ', '')}</p>}
                    <div className="btn-row" style={{ marginTop: 10, alignItems: 'center' }}>
                      <span className={`badge ${s.raw_sent ? 'badge--green' : 'badge--gray'}`}>Ảnh gốc: {s.raw_sent ? 'đã gửi' : 'chưa'}</span>
                      <span className={`badge ${s.editing_done ? 'badge--green' : 'badge--amber'}`}>Làm hình: {s.editing_done ? 'xong' : 'chưa'}</span>
                      <span className={`badge ${s.delivered ? 'badge--green' : 'badge--amber'}`}>Giao ảnh: {s.delivered ? 'đã giao' : 'chưa'}</span>
                      {isAdmin && <button className="btn btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setPay(s)}>💰 Thu tiền</button>}
                      <button className="btn btn--ghost btn--sm" style={isAdmin ? {} : { marginLeft: 'auto' }} onClick={() => { onClose(); nav(`/buoi-chup?q=${encodeURIComponent(s.code)}`); }}>Mở buổi ↗</button>
                      {isAdmin && <button className="btn btn--ghost btn--sm" onClick={() => openReassign(s)}>↗ Tách khách</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {reassign && (
        <div className="modal-bg" onClick={() => setReassign(null)} style={{ zIndex: 60 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head"><h3>Tách buổi {reassign.code} sang khách</h3><button onClick={() => setReassign(null)}>×</button></div>
            <div className="modal__body">
              <div className="btn-row" style={{ marginBottom: 12 }}>
                <button className={`btn btn--sm ${targetMode === 'new' ? '' : 'btn--ghost'}`} onClick={() => setTargetMode('new')}>Khách mới</button>
                <button className={`btn btn--sm ${targetMode === 'existing' ? '' : 'btn--ghost'}`} onClick={() => setTargetMode('existing')}>Khách đã có</button>
              </div>
              {targetMode === 'new' ? (
                <Field label="Tên khách (gợi ý từ mô tả Google)" hint="SĐT/email bổ sung sau trong mục Khách hàng.">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="VD: Hoàng Nam & Bé Thảo" />
                </Field>
              ) : (
                <Field label="Chọn khách có sẵn">
                  <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                    <option value="">— Chọn khách —</option>
                    {existing.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.code})</option>)}
                  </select>
                </Field>
              )}
            </div>
            <div className="modal__foot">
              <button className="btn btn--ghost" onClick={() => setReassign(null)}>Hủy</button>
              <button className="btn" onClick={doReassign} disabled={busy}>{busy ? 'Đang tách…' : 'Tách sang khách'}</button>
            </div>
          </div>
        </div>
      )}

      {pay && (
        <PaymentsModal
          shootId={pay.id}
          shootLabel={`${pay.code} — ${pay.shoot_type || pay.title || ''}`}
          onClose={() => setPay(null)}
          onChanged={reload}
        />
      )}
    </Modal>
  );
}
