import { useState } from 'react';
import { Field } from '../../components/ui';
import ImageUpload from '../../components/ImageUpload';
import { SaveBar } from './SaveBar';

export default function LienHeEditor({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const [d, setD] = useState<any>({ tai_khoan: [], ...data });
  const [dirty, setDirty] = useState(false);
  const set = (k: string, v: any) => { setD({ ...d, [k]: v }); setDirty(true); };

  const setTk = (i: number, k: string, v: any) => {
    const tk = [...(d.tai_khoan || [])];
    tk[i] = { ...tk[i], [k]: v };
    set('tai_khoan', tk);
  };
  const addTk = () => set('tai_khoan', [...(d.tai_khoan || []), { nhan: 'Tài khoản', chinh: false, chu_tk: '', so_tk: '', ngan_hang: '', qr: '' }]);
  const delTk = (i: number) => set('tai_khoan', (d.tai_khoan || []).filter((_: any, x: number) => x !== i));

  const save = async () => { await onSave(d); setDirty(false); };

  return (
    <div className="card">
      <h2>Thông tin liên hệ</h2>
      <div className="field-row">
        <Field label="Tên studio"><input value={d.ten_studio || ''} onChange={(e) => set('ten_studio', e.target.value)} /></Field>
        <Field label="Địa chỉ"><input value={d.dia_chi || ''} onChange={(e) => set('dia_chi', e.target.value)} /></Field>
      </div>
      <div className="field-row">
        <Field label="Hotline 1"><input value={d.hotline_1 || ''} onChange={(e) => set('hotline_1', e.target.value)} /></Field>
        <Field label="Tên người nghe HL1"><input value={d.hotline_1_ten || ''} onChange={(e) => set('hotline_1_ten', e.target.value)} /></Field>
      </div>
      <div className="field-row">
        <Field label="Hotline 2"><input value={d.hotline_2 || ''} onChange={(e) => set('hotline_2', e.target.value)} /></Field>
        <Field label="Tên người nghe HL2"><input value={d.hotline_2_ten || ''} onChange={(e) => set('hotline_2_ten', e.target.value)} /></Field>
      </div>
      <div className="field-row">
        <Field label="Zalo"><input value={d.zalo || ''} onChange={(e) => set('zalo', e.target.value)} /></Field>
        <Field label="Email nhận form"><input value={d.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
      </div>
      <div className="field-row">
        <Field label="Ngày mở cửa"><input value={d.ngay_mo_cua || ''} onChange={(e) => set('ngay_mo_cua', e.target.value)} /></Field>
        <Field label="Giờ mở cửa"><input value={d.gio_mo_cua || ''} onChange={(e) => set('gio_mo_cua', e.target.value)} /></Field>
      </div>
      <Field label="Link Google Maps"><input value={d.google_maps || ''} onChange={(e) => set('google_maps', e.target.value)} /></Field>
      <div className="field-row">
        <Field label="Link Fanpage"><input value={d.fanpage || ''} onChange={(e) => set('fanpage', e.target.value)} /></Field>
        <Field label="Tên Fanpage"><input value={d.fanpage_ten || ''} onChange={(e) => set('fanpage_ten', e.target.value)} /></Field>
      </div>
      <div className="field-row">
        <Field label="Link Facebook cá nhân"><input value={d.facebook_ca_nhan || ''} onChange={(e) => set('facebook_ca_nhan', e.target.value)} /></Field>
        <Field label="Tên Facebook cá nhân"><input value={d.facebook_ca_nhan_ten || ''} onChange={(e) => set('facebook_ca_nhan_ten', e.target.value)} /></Field>
      </div>
      <div className="field-row">
        <Field label="Link Instagram"><input value={d.instagram || ''} onChange={(e) => set('instagram', e.target.value)} /></Field>
        <Field label="Tên Instagram"><input value={d.instagram_ten || ''} onChange={(e) => set('instagram_ten', e.target.value)} /></Field>
      </div>

      <h2 style={{ marginTop: 20 }}>Tài khoản ngân hàng</h2>
      {(d.tai_khoan || []).map((tk: any, i: number) => (
        <div key={i} className="card" style={{ background: '#faf7f2', marginBottom: 12 }}>
          <div className="field-row">
            <Field label="Nhãn"><input value={tk.nhan || ''} onChange={(e) => setTk(i, 'nhan', e.target.value)} /></Field>
            <div className="field checkbox" style={{ marginTop: 26 }}>
              <input type="checkbox" id={`tk-chinh-${i}`} checked={!!tk.chinh} onChange={(e) => setTk(i, 'chinh', e.target.checked)} />
              <label htmlFor={`tk-chinh-${i}`} style={{ margin: 0 }}>Là tài khoản chính</label>
            </div>
          </div>
          <Field label="Chủ tài khoản"><input value={tk.chu_tk || ''} onChange={(e) => setTk(i, 'chu_tk', e.target.value)} /></Field>
          <div className="field-row">
            <Field label="Số tài khoản"><input value={tk.so_tk || ''} onChange={(e) => setTk(i, 'so_tk', e.target.value)} /></Field>
            <Field label="Ngân hàng / chi nhánh"><input value={tk.ngan_hang || ''} onChange={(e) => setTk(i, 'ngan_hang', e.target.value)} /></Field>
          </div>
          <ImageUpload label="Ảnh mã QR" value={tk.qr || ''} onChange={(url) => setTk(i, 'qr', url)} />
          <Field label="Mô tả ảnh QR"><input value={tk.mo_ta_qr || ''} onChange={(e) => setTk(i, 'mo_ta_qr', e.target.value)} /></Field>
          <button className="btn btn--danger btn--sm" onClick={() => delTk(i)}>Xóa tài khoản này</button>
        </div>
      ))}
      <button className="btn btn--ghost btn--sm" onClick={addTk}>+ Thêm tài khoản</button>

      <SaveBar onSave={save} dirty={dirty} />
    </div>
  );
}
