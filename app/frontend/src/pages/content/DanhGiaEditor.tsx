import { useState } from 'react';
import { Field } from '../../components/ui';
import ImageUpload from '../../components/ImageUpload';
import { SaveBar } from './SaveBar';

export default function DanhGiaEditor({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const [d, setD] = useState<any>({ danh_gia: [], ...data });
  const [dirty, setDirty] = useState(false);
  const setTop = (k: string, v: any) => { setD({ ...d, [k]: v }); setDirty(true); };

  const dg: any[] = d.danh_gia || [];
  const change = (v: any[]) => setTop('danh_gia', v);
  const setItem = (i: number, k: string, val: any) => { const n = [...dg]; n[i] = { ...n[i], [k]: val }; change(n); };
  const add = () => change([{ ten: '', nguon: 'Facebook', ngay: new Date().toISOString().slice(0, 10), noi_dung: '', de_xuat: true, so_sao: 5, ghim: false }, ...dg]);
  const del = (i: number) => { if (!confirm('Xóa đánh giá này?')) return; change(dg.filter((_, x) => x !== i)); };

  const save = async () => { await onSave(d); setDirty(false); };

  return (
    <div className="card">
      <h2>Đánh giá khách hàng</h2>
      <div className="field-row">
        <Field label="Fanpage — % giới thiệu"><input value={d.facebook_phan_tram || ''} onChange={(e) => setTop('facebook_phan_tram', e.target.value)} /></Field>
        <Field label="Fanpage — số đánh giá"><input value={d.facebook_so_danh_gia || ''} onChange={(e) => setTop('facebook_so_danh_gia', e.target.value)} /></Field>
      </div>
      <Field label="Google Maps — điểm (vd 5,0)"><input value={d.google_diem || ''} onChange={(e) => setTop('google_diem', e.target.value)} /></Field>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 10px' }}>
        <h2 style={{ margin: 0 }}>Các đánh giá ({dg.length})</h2>
        <button className="btn btn--ghost btn--sm" onClick={add}>+ Thêm đánh giá</button>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>Chỉ đăng đánh giá thật, giữ nguyên văn lời khách.</p>

      {dg.map((r, i) => (
        <div key={i} className="card" style={{ background: '#faf7f2', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <b>{r.ten || '(chưa có tên)'} — {r.nguon}</b>
            <button className="btn btn--danger btn--sm" onClick={() => del(i)}>Xóa</button>
          </div>
          <div className="field-row">
            <Field label="Tên khách"><input value={r.ten || ''} onChange={(e) => setItem(i, 'ten', e.target.value)} /></Field>
            <Field label="Nguồn">
              <select value={r.nguon || 'Facebook'} onChange={(e) => setItem(i, 'nguon', e.target.value)}>
                <option>Facebook</option>
                <option>Google Maps</option>
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Ngày đăng"><input type="date" value={(r.ngay || '').slice(0, 10)} onChange={(e) => setItem(i, 'ngay', e.target.value)} /></Field>
            <Field label="Số sao (Google)"><input type="number" min={1} max={5} value={r.so_sao ?? 5} onChange={(e) => setItem(i, 'so_sao', Number(e.target.value))} /></Field>
          </div>
          <Field label="Lời khách (giữ nguyên văn)"><textarea value={r.noi_dung || ''} onChange={(e) => setItem(i, 'noi_dung', e.target.value)} /></Field>
          <Field label="Album liên quan (tên album trong Bộ sưu tập)"><input value={r.album || ''} onChange={(e) => setItem(i, 'album', e.target.value)} /></Field>
          <div className="field-row">
            <ImageUpload label="Ảnh bên trái (để trống = tự chọn)" value={r.anh || ''} onChange={(url) => setItem(i, 'anh', url)} />
            <ImageUpload label="Ảnh đại diện khách" value={r.anh_dai_dien || ''} onChange={(url) => setItem(i, 'anh_dai_dien', url)} />
          </div>
          <ImageUpload label="Ảnh chụp màn hình đánh giá gốc" value={r.anh_chup_goc || ''} onChange={(url) => setItem(i, 'anh_chup_goc', url)} />
          <div style={{ display: 'flex', gap: 20 }}>
            <div className="checkbox"><input type="checkbox" id={`dg-dx-${i}`} checked={r.de_xuat !== false} onChange={(e) => setItem(i, 'de_xuat', e.target.checked)} /><label htmlFor={`dg-dx-${i}`}>Khách có đề xuất</label></div>
            <div className="checkbox"><input type="checkbox" id={`dg-gh-${i}`} checked={!!r.ghim} onChange={(e) => setItem(i, 'ghim', e.target.checked)} /><label htmlFor={`dg-gh-${i}`}>Ghim lên đầu</label></div>
          </div>
        </div>
      ))}
      <SaveBar onSave={save} dirty={dirty} />
    </div>
  );
}
