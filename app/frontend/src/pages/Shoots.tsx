import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Field, Spinner, Empty, StatusBadge, money, dateVN } from '../components/ui';
import { useAuth } from '../lib/auth';
import PaymentsModal from '../components/PaymentsModal';

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
  const { isAdmin } = useAuth();
  const [list, setList] = useState<Shoot[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [opts, setOpts] = useState<{ shootStatus: string[]; shootTypes: string[] }>({ shootStatus: [], shootTypes: [] });
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Shoot> | null>(null);
  const [pay, setPay] = useState<Shoot | null>(null);
  const [err, setErr] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (q) params.set('q', q);
    api.get<Shoot[]>(`/shoots?${params}`).then(setList).catch(() => setList([]));
  };
  useEffect(load, [statusFilter, q]);
  useEffect(() => {
    api.get<Customer[]>('/customers').then(setCustomers).catch(() => {});
    api.get<Staff[]>('/meta/staff').then(setStaff).catch(() => {});
    api.get('/meta/options').then(setOpts).catch(() => {});
  }, []);

  const openNew = () => { setEdit({ status: 'Đã đặt lịch', total_amount: 0, deposit_amount: 0 }); setErr(''); };

  const save = async () => {
    if (!edit?.customer_id) { setErr('Chọn khách hàng'); return; }
    setErr('');
    try {
      if (edit.id) await api.put(`/shoots/${edit.id}`, edit);
      else await api.post('/shoots', edit);
      setEdit(null);
      load();
    } catch (e: any) { setErr(e.message); }
  };

  const remove = async (s: Shoot) => {
    if (!confirm(`Xóa buổi chụp ${s.code}? (Xóa cả bản ghi giao hình)`)) return;
    try { await api.del(`/shoots/${s.id}`); load(); }
    catch (e: any) { alert(e.message); }
  };

  const staffName = (id?: string) => staff.find((s) => s.id === id)?.full_name;
  const photographers = staff.filter((s) => s.role === 'Photo');
  const makeupArtists = staff.filter((s) => s.role === 'Makeup');

  return (
    <>
      <div className="page-head">
        <h1>Buổi chụp</h1>
        {isAdmin && <button className="btn" onClick={openNew}>+ Thêm buổi chụp</button>}
      </div>

      <div className="toolbar">
        <input placeholder="Tìm khách / mã / tiêu đề…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {opts.shootStatus.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {!list ? <Spinner /> : list.length === 0 ? <Empty text="Chưa có buổi chụp nào." /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Mã</th><th>Khách</th><th>Ngày chụp</th><th>Loại</th><th>Người chụp</th><th>Tiền</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="muted">{s.code}</td>
                  <td><b>{s.customer_name}</b><div className="muted" style={{ fontSize: 12.5 }}>{s.title || ''}</div></td>
                  <td>{dateVN(s.shoot_date)}{s.start_time ? <div className="muted" style={{ fontSize: 12 }}>{s.start_time}{s.end_time ? '–' + s.end_time : ''}</div> : null}</td>
                  <td className="muted">{s.shoot_type || '—'}</td>
                  <td className="muted">{staffName(s.photographer_id) || '—'}</td>
                  <td>
                    {money(s.total_amount)}
                    {!s.paid_full && (s.deposit_amount ?? 0) > 0 && <div className="muted" style={{ fontSize: 12 }}>Cọc {money(s.deposit_amount)}</div>}
                    {s.paid_full ? <div style={{ fontSize: 12, color: 'var(--green)' }}>Đã đủ</div> : null}
                  </td>
                  <td><StatusBadge status={s.status || ''} /></td>
                  <td>
                    <div className="btn-row">
                      {isAdmin ? <>
                        <button className="btn btn--ghost btn--sm" onClick={() => setPay(s)}>Thu tiền</button>
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
      )}

      {edit && (
        <Modal
          title={edit.id ? `Sửa buổi chụp ${edit.code || ''}` : 'Thêm buổi chụp'}
          onClose={() => setEdit(null)}
          wide
          footer={<>
            <button className="btn btn--ghost" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn" onClick={save}>Lưu</button>
          </>}
        >
          {err && <div className="msg msg--err">{err}</div>}
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
          <Field label="Tiêu đề buổi chụp"><input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="VD: Chụp ngoại cảnh gói VIP" /></Field>
          <div className="field-row">
            <Field label="Gói dịch vụ"><input value={edit.package_name || ''} onChange={(e) => setEdit({ ...edit, package_name: e.target.value })} /></Field>
            <Field label="Loại chụp">
              <select value={edit.shoot_type || ''} onChange={(e) => setEdit({ ...edit, shoot_type: e.target.value })}>
                <option value="">— Chọn —</option>
                {opts.shootTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
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
          <div className="field-row">
            <Field label="Tổng tiền (đ)"><input type="number" value={edit.total_amount ?? 0} onChange={(e) => setEdit({ ...edit, total_amount: Number(e.target.value) })} /></Field>
            <Field label="Đã cọc (đ)"><input type="number" value={edit.deposit_amount ?? 0} onChange={(e) => setEdit({ ...edit, deposit_amount: Number(e.target.value) })} /></Field>
          </div>
          {!edit.id && (
            <Field label="Ngày khách cần ảnh (hạn giao)" hint="Tạo sẵn bản ghi theo dõi giao hình.">
              <input type="date" value={edit.due_date?.slice(0, 10) || ''} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} />
            </Field>
          )}
          <div className="field checkbox">
            <input type="checkbox" id="paid" checked={!!edit.paid_full} onChange={(e) => setEdit({ ...edit, paid_full: e.target.checked ? 1 : 0 })} />
            <label htmlFor="paid" style={{ margin: 0 }}>Đã thanh toán đủ</label>
          </div>
          <Field label="Ghi chú"><textarea value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
        </Modal>
      )}

      {pay && (
        <PaymentsModal
          shootId={pay.id}
          shootLabel={`${pay.customer_name || ''} (${pay.code})`}
          onClose={() => setPay(null)}
          onChanged={load}
        />
      )}
    </>
  );
}
