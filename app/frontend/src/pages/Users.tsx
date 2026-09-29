import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Field, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../lib/auth';

interface User {
  id: string; full_name: string; username: string; email: string; phone?: string;
  role: 'Admin' | 'NhanVien'; status: string;
}

export default function Users() {
  const { user: me } = useAuth();
  const [list, setList] = useState<User[] | null>(null);
  const [edit, setEdit] = useState<Partial<User> & { password?: string } | null>(null);
  const [reset, setReset] = useState<User | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.get<User[]>('/users').then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    setErr('');
    try {
      if (edit.id) {
        await api.put(`/users/${edit.id}`, edit);
      } else {
        if (!edit.password || edit.password.length < 6) { setErr('Mật khẩu phải từ 6 ký tự'); return; }
        await api.post('/users', edit);
      }
      setEdit(null);
      load();
    } catch (e: any) { setErr(e.message); }
  };

  const doReset = async () => {
    if (!reset) return;
    if (resetPw.length < 6) { setErr('Mật khẩu phải từ 6 ký tự'); return; }
    try {
      await api.post(`/users/${reset.id}/reset-password`, { new_password: resetPw });
      setReset(null); setResetPw('');
      alert('Đã đặt lại mật khẩu.');
    } catch (e: any) { alert(e.message); }
  };

  const remove = async (u: User) => {
    if (!confirm(`Xóa người dùng "${u.full_name}"?`)) return;
    try { await api.del(`/users/${u.id}`); load(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <h1>Người dùng</h1>
        <button className="btn" onClick={() => { setEdit({ role: 'NhanVien' }); setErr(''); }}>+ Thêm người dùng</button>
      </div>

      {!list ? <Spinner /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Họ tên</th><th>Đăng nhập</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.full_name}</b>{u.id === me?.id && <span className="muted"> (bạn)</span>}</td>
                  <td className="muted">{u.username}</td>
                  <td className="muted">{u.email}</td>
                  <td><span className={`badge ${u.role === 'Admin' ? 'badge--amber' : 'badge--blue'}`}>{u.role === 'Admin' ? 'Quản trị' : 'Nhân viên'}</span></td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn--ghost btn--sm" onClick={() => { setEdit(u); setErr(''); }}>Sửa</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => { setReset(u); setResetPw(''); setErr(''); }}>Đặt lại MK</button>
                      {u.id !== me?.id && <button className="btn btn--danger btn--sm" onClick={() => remove(u)}>Xóa</button>}
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
          title={edit.id ? 'Sửa người dùng' : 'Thêm người dùng'}
          onClose={() => setEdit(null)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn" onClick={save}>Lưu</button>
          </>}
        >
          {err && <div className="msg msg--err">{err}</div>}
          <Field label="Họ tên *"><input value={edit.full_name || ''} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></Field>
          {!edit.id && (
            <div className="field-row">
              <Field label="Tên đăng nhập *"><input value={edit.username || ''} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></Field>
              <Field label="Mật khẩu *"><input type="text" value={edit.password || ''} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
            </div>
          )}
          <div className="field-row">
            <Field label="Email *"><input value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Số điện thoại"><input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
          </div>
          <div className="field-row">
            <Field label="Vai trò">
              <select value={edit.role || 'NhanVien'} onChange={(e) => setEdit({ ...edit, role: e.target.value as any })}>
                <option value="NhanVien">Nhân viên</option>
                <option value="Admin">Quản trị</option>
              </select>
            </Field>
            {edit.id && (
              <Field label="Trạng thái">
                <select value={edit.status || 'Hoạt động'} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Tạm khóa">Tạm khóa</option>
                </select>
              </Field>
            )}
          </div>
        </Modal>
      )}

      {reset && (
        <Modal
          title={`Đặt lại mật khẩu — ${reset.full_name}`}
          onClose={() => setReset(null)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setReset(null)}>Hủy</button>
            <button className="btn" onClick={doReset}>Đặt lại</button>
          </>}
        >
          {err && <div className="msg msg--err">{err}</div>}
          <Field label="Mật khẩu mới" hint="Tối thiểu 6 ký tự. Báo lại mật khẩu này cho nhân viên."><input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} /></Field>
        </Modal>
      )}
    </>
  );
}
