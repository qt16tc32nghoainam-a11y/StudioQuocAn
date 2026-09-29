import { useState } from 'react';
import { Field } from '../../components/ui';
import ImageUpload from '../../components/ImageUpload';
import { SaveBar } from './SaveBar';

export default function DoiNguEditor({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const [tv, setTv] = useState<any[]>(data?.thanh_vien || []);
  const [dirty, setDirty] = useState(false);
  const change = (v: any[]) => { setTv(v); setDirty(true); };

  const setItem = (i: number, k: string, val: any) => { const n = [...tv]; n[i] = { ...n[i], [k]: val }; change(n); };
  const add = () => change([...tv, { ten: '', chuc_danh: '', gioi_thieu: '', anh: '', facebook: '', nhan: '', noi_bat: false }]);
  const del = (i: number) => { if (!confirm('Xóa thành viên này?')) return; change(tv.filter((_, x) => x !== i)); };
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= tv.length) return; const n = [...tv];[n[i], n[j]] = [n[j], n[i]]; change(n); };

  const save = async () => { await onSave({ ...data, thanh_vien: tv }); setDirty(false); };

  return (
    <div className="card">
      <h2>Đội ngũ</h2>
      {tv.length === 0 && <p className="muted">Chưa có thành viên.</p>}
      {tv.map((t, i) => (
        <div key={i} className="card" style={{ background: '#faf7f2', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <b>Thành viên {i + 1}: {t.ten || '(chưa đặt tên)'}</b>
            <div className="btn-row">
              <button className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === tv.length - 1}>↓</button>
              <button className="btn btn--danger btn--sm" onClick={() => del(i)}>Xóa</button>
            </div>
          </div>
          <div className="field-row">
            <Field label="Họ tên"><input value={t.ten || ''} onChange={(e) => setItem(i, 'ten', e.target.value)} /></Field>
            <Field label="Chức danh"><input value={t.chuc_danh || ''} onChange={(e) => setItem(i, 'chuc_danh', e.target.value)} /></Field>
          </div>
          <Field label="Giới thiệu"><textarea value={t.gioi_thieu || ''} onChange={(e) => setItem(i, 'gioi_thieu', e.target.value)} /></Field>
          <ImageUpload label="Ảnh đại diện (vuông đẹp nhất)" value={t.anh || ''} onChange={(url) => setItem(i, 'anh', url)} />
          <div className="field-row">
            <Field label="Link Facebook"><input value={t.facebook || ''} onChange={(e) => setItem(i, 'facebook', e.target.value)} /></Field>
            <Field label="Nhãn trên thẻ (vd Người sáng lập)"><input value={t.nhan || ''} onChange={(e) => setItem(i, 'nhan', e.target.value)} /></Field>
          </div>
          <div className="field checkbox">
            <input type="checkbox" id={`tv-nb-${i}`} checked={!!t.noi_bat} onChange={(e) => setItem(i, 'noi_bat', e.target.checked)} />
            <label htmlFor={`tv-nb-${i}`} style={{ margin: 0 }}>Làm nổi bật thẻ này</label>
          </div>
        </div>
      ))}
      <button className="btn btn--ghost btn--sm" onClick={add}>+ Thêm thành viên</button>
      <SaveBar onSave={save} dirty={dirty} />
    </div>
  );
}
