import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Field, Spinner, Empty, money, dateVN } from '../components/ui';

interface Expense {
  id: string; ngay: string; loai?: string; so_tien: number; mo_ta?: string;
  shoot_id?: string; shoot_code?: string; customer_name?: string;
}
interface Shoot { id: string; code: string; customer_name?: string; }

export default function Expenses() {
  const [list, setList] = useState<Expense[] | null>(null);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [edit, setEdit] = useState<Partial<Expense> | null>(null);
  const [err, setErr] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const load = () => {
    const from = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const to = new Date(y, m, 0).toISOString().slice(0, 10); // ngày cuối tháng
    api.get<Expense[]>(`/expenses?from=${from}&to=${to}`).then(setList).catch(() => setList([]));
  };
  useEffect(load, [month]);
  useEffect(() => {
    api.get<Shoot[]>('/shoots').then(setShoots).catch(() => {});
    api.get('/meta/options').then((o) => setTypes(o.expenseTypes || [])).catch(() => {});
  }, []);

  const save = async () => {
    if (!edit?.so_tien || Number(edit.so_tien) <= 0) { setErr('Nhập số tiền'); return; }
    setErr('');
    try {
      if (edit.id) await api.put(`/expenses/${edit.id}`, edit);
      else await api.post('/expenses', edit);
      setEdit(null); load();
    } catch (e: any) { setErr(e.message); }
  };
  const remove = async (x: Expense) => {
    if (!confirm('Xóa khoản chi này?')) return;
    try { await api.del(`/expenses/${x.id}`); load(); } catch (e: any) { alert(e.message); }
  };

  const total = (list || []).reduce((s, x) => s + (Number(x.so_tien) || 0), 0);

  return (
    <>
      <div className="page-head">
        <h1>Chi phí</h1>
        <button className="btn" onClick={() => { setEdit({ ngay: new Date().toISOString().slice(0, 10) }); setErr(''); }}>+ Thêm chi phí</button>
      </div>

      <div className="toolbar">
        <label className="muted" style={{ fontSize: 14 }}>Tháng:</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <span style={{ marginLeft: 'auto', fontWeight: 600 }}>Tổng chi tháng: <span style={{ color: 'var(--red)' }}>{money(total)}đ</span></span>
      </div>

      {!list ? <Spinner /> : list.length === 0 ? <Empty text="Chưa có khoản chi nào trong tháng này." /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Ngày</th><th>Loại</th><th>Số tiền</th><th>Mô tả</th><th>Gắn buổi chụp</th><th></th></tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>{dateVN(x.ngay)}</td>
                  <td>{x.loai || '—'}</td>
                  <td style={{ color: 'var(--red)', fontWeight: 600 }}>{money(x.so_tien)}</td>
                  <td className="muted">{x.mo_ta || '—'}</td>
                  <td className="muted">{x.shoot_code ? `${x.shoot_code} (${x.customer_name})` : '— chung —'}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn--ghost btn--sm" onClick={() => { setEdit(x); setErr(''); }}>Sửa</button>
                      <button className="btn btn--danger btn--sm" onClick={() => remove(x)}>Xóa</button>
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
          title={edit.id ? 'Sửa chi phí' : 'Thêm chi phí'}
          onClose={() => setEdit(null)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn" onClick={save}>Lưu</button>
          </>}
        >
          {err && <div className="msg msg--err">{err}</div>}
          <div className="field-row">
            <Field label="Ngày"><input type="date" value={(edit.ngay || '').slice(0, 10)} onChange={(e) => setEdit({ ...edit, ngay: e.target.value })} /></Field>
            <Field label="Số tiền (đ)"><input type="number" value={edit.so_tien ?? ''} onChange={(e) => setEdit({ ...edit, so_tien: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Loại chi phí">
            <select value={edit.loai || ''} onChange={(e) => setEdit({ ...edit, loai: e.target.value })}>
              <option value="">— Chọn —</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Mô tả"><input value={edit.mo_ta || ''} onChange={(e) => setEdit({ ...edit, mo_ta: e.target.value })} /></Field>
          <Field label="Gắn vào buổi chụp (không bắt buộc)" hint="Để trống = chi phí chung. Chọn buổi chụp = chi phí riêng của buổi đó.">
            <select value={edit.shoot_id || ''} onChange={(e) => setEdit({ ...edit, shoot_id: e.target.value })}>
              <option value="">— Chi phí chung —</option>
              {shoots.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.customer_name}</option>)}
            </select>
          </Field>
        </Modal>
      )}
    </>
  );
}
