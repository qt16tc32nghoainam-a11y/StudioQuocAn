import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Field, Spinner, Empty, money } from '../components/ui';

interface Pkg {
  id: string; code?: string; name: string; price: number; unit?: string;
  description?: string; items: string[]; published: boolean; featured: boolean; sort_order?: number;
}

const EMPTY: Partial<Pkg> = { name: '', price: 0, unit: '/gói', description: '', items: [], published: false, featured: false, sort_order: 0 };

export default function Packages() {
  const [list, setList] = useState<Pkg[] | null>(null);
  const [edit, setEdit] = useState<(Partial<Pkg> & { itemsText?: string }) | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.get<Pkg[]>('/packages').then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit({ ...EMPTY, itemsText: '' }); setErr(''); };
  const openEdit = (p: Pkg) => { setEdit({ ...p, itemsText: (p.items || []).join('\n') }); setErr(''); };

  const save = async () => {
    if (!edit?.name?.trim()) { setErr('Nhập tên gói'); return; }
    if (Number(edit.price) < 0) { setErr('Giá không hợp lệ'); return; }
    setErr(''); setSaving(true);
    const items = (edit.itemsText || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const body = { ...edit, items };
    try {
      if (edit.id) await api.put(`/packages/${edit.id}`, body);
      else await api.post('/packages', body);
      setEdit(null); load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (p: Pkg) => {
    if (!confirm(`Xóa gói "${p.name}"? (Các buổi đã chọn gói này vẫn giữ nguyên tổng tiền.)`)) return;
    try { await api.del(`/packages/${p.id}`); load(); } catch (e: any) { alert(e.message); }
  };

  const togglePublish = async (p: Pkg) => {
    try { await api.put(`/packages/${p.id}`, { published: !p.published }); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <h1>Gói dịch vụ</h1>
        <button className="btn" onClick={openNew}>+ Thêm gói</button>
      </div>

      <div className="hint" style={{ background: '#f6efe3', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 12px', marginBottom: 14 }}>
        💡 Gói bật <b>Công bố</b> sẽ lên bảng giá website (sau khi bấm <b>Công bố</b> ở mục Nội dung website). Gói không công bố chỉ dùng nội bộ cho Sale chọn khi tạo khách.
      </div>

      {!list ? <Spinner /> : list.length === 0 ? <Empty text="Chưa có gói dịch vụ nào. Bấm “+ Thêm gói”." /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Mã</th><th>Tên gói</th><th>Giá</th><th>Quyền lợi</th><th>Công bố</th><th></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="muted">{p.code}</td>
                  <td><b>{p.name}</b>{p.featured ? <span className="badge badge--amber" style={{ marginLeft: 6 }}>Nổi bật</span> : null}
                    {p.description ? <div className="muted" style={{ fontSize: 12.5 }}>{p.description}</div> : null}</td>
                  <td><b>{money(p.price)}</b><span className="muted" style={{ fontSize: 12 }}>{p.unit || ''}</span></td>
                  <td className="muted" style={{ fontSize: 13 }}>{(p.items || []).length} mục</td>
                  <td>
                    <button className={`btn btn--sm ${p.published ? '' : 'btn--ghost'}`} onClick={() => togglePublish(p)}>
                      {p.published ? '✓ Đã công bố' : 'Nội bộ'}
                    </button>
                  </td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn--ghost btn--sm" onClick={() => openEdit(p)}>Sửa</button>
                      <button className="btn btn--danger btn--sm" onClick={() => remove(p)}>Xóa</button>
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
          title={edit.id ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}
          onClose={() => setEdit(null)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn" onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
          </>}
        >
          {err && <div className="msg msg--err">{err}</div>}
          <Field label="Tên gói *"><input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="VD: Gói cưới trọn gói VIP" /></Field>
          <div className="field-row">
            <Field label="Giá (đ)"><input type="number" value={edit.price ?? 0} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></Field>
            <Field label="Đơn vị" hint="Hiển thị sau giá trên web."><input value={edit.unit || ''} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="/gói" /></Field>
          </div>
          <Field label="Mô tả ngắn"><input value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="VD: Trọn gói chụp phóng sự cả ngày cưới" /></Field>
          <Field label="Quyền lợi (mỗi dòng 1 mục)" hint="Hiện thành danh sách gạch đầu dòng trên website.">
            <textarea rows={5} value={edit.itemsText || ''} onChange={(e) => setEdit({ ...edit, itemsText: e.target.value })} placeholder={'Chụp 8 tiếng\n300 ảnh chỉnh sửa\n1 album 25x30'} />
          </Field>
          <div className="field-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} />
              Công bố lên website
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked })} />
              Gói nổi bật
            </label>
          </div>
          <Field label="Thứ tự hiển thị" hint="Số nhỏ hiện trước."><input type="number" value={edit.sort_order ?? 0} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></Field>
        </Modal>
      )}
    </>
  );
}
