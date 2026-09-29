import { useState } from 'react';
import ImageUpload from '../../components/ImageUpload';
import { SaveBar } from './SaveBar';

export default function BannerEditor({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const [anh, setAnh] = useState<any[]>(data?.anh || []);
  const [dirty, setDirty] = useState(false);
  const change = (v: any[]) => { setAnh(v); setDirty(true); };

  const setItem = (i: number, k: string, val: string) => {
    const next = [...anh]; next[i] = { ...next[i], [k]: val }; change(next);
  };
  const add = () => change([...anh, { anh: '', anh_dien_thoai: '' }]);
  const del = (i: number) => change(anh.filter((_, x) => x !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= anh.length) return;
    const next = [...anh];[next[i], next[j]] = [next[j], next[i]]; change(next);
  };

  const save = async () => { await onSave({ ...data, anh }); setDirty(false); };

  return (
    <div className="card">
      <h2>Ảnh banner trang chủ</h2>
      <p className="muted" style={{ fontSize: 13.5 }}>Ảnh ngang. Ảnh tải lên sẽ được website tự cắt 1600×900 (máy tính) và 1080×810 (điện thoại).</p>
      {anh.length === 0 && <p className="muted">Chưa có ảnh banner.</p>}
      {anh.map((x, i) => (
        <div key={i} className="card" style={{ background: '#faf7f2', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <b>Ảnh {i + 1}</b>
            <div className="btn-row">
              <button className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === anh.length - 1}>↓</button>
              <button className="btn btn--danger btn--sm" onClick={() => del(i)}>Xóa</button>
            </div>
          </div>
          <ImageUpload label="Ảnh (máy tính)" value={x.anh || ''} onChange={(url) => setItem(i, 'anh', url)} />
          <ImageUpload label="Ảnh riêng cho điện thoại (không bắt buộc)" value={x.anh_dien_thoai || ''} onChange={(url) => setItem(i, 'anh_dien_thoai', url)} />
        </div>
      ))}
      <button className="btn btn--ghost btn--sm" onClick={add}>+ Thêm ảnh banner</button>
      <SaveBar onSave={save} dirty={dirty} />
    </div>
  );
}
