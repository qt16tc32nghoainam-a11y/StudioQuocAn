import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Field, Spinner, Empty } from '../components/ui';
import { useAuth } from '../lib/auth';

interface Customer {
  id: string; code: string; full_name: string; phone?: string; email?: string;
  address?: string; source?: string; note?: string;
}

const EMPTY: Partial<Customer> = { full_name: '', phone: '', email: '', address: '', source: '', note: '' };

export default function Customers() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState<Customer[] | null>(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Customer> | null>(null);
  const [err, setErr] = useState('');
  const [sources, setSources] = useState<string[]>([]);

  const load = () => {
    api.get<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(setList).catch(() => setList([]));
  };
  useEffect(load, [q]);
  useEffect(() => { api.get('/meta/options').then((o) => setSources(o.sources || [])).catch(() => {}); }, []);

  const save = async () => {
    if (!edit?.full_name?.trim()) { setErr('Nhập tên khách hàng'); return; }
    setErr('');
    try {
      if (edit.id) await api.put(`/customers/${edit.id}`, edit);
      else await api.post('/customers', edit);
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
                      {isAdmin ? <>
                        <button className="btn btn--ghost btn--sm" onClick={() => { setEdit(c); setErr(''); }}>Sửa</button>
                        <button className="btn btn--danger btn--sm" onClick={() => remove(c)}>Xóa</button>
                      </> : <span className="muted" style={{ fontSize: 13 }}>—</span>}
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
            <Field label="Số điện thoại"><input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Email"><input value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
          </div>
          <Field label="Địa chỉ"><input value={edit.address || ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
          <Field label="Nguồn khách">
            <select value={edit.source || ''} onChange={(e) => setEdit({ ...edit, source: e.target.value })}>
              <option value="">— Chọn —</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Ghi chú"><textarea value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
