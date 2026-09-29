import { useState } from 'react';
import { Modal, Field } from '../../components/ui';
import ImageUpload from '../../components/ImageUpload';
import { SaveBar } from './SaveBar';

/**
 * Editor Bảng giá — form CRUD cho các khối (muc[]) và 3 thẻ tóm tắt trang chủ.
 * Hỗ trợ 4 kiểu khối: the (thẻ gói), cong (nhiều mức giá), bang (bảng), anh (ảnh bảng giá).
 * Danh sách các dòng nhập nhanh bằng textarea (mỗi dòng 1 mục), giữ đúng cấu trúc JSON của website.
 */
type Kieu = 'the' | 'cong' | 'bang' | 'anh';
const KIEU_LABEL: Record<Kieu, string> = {
  the: 'Thẻ gói (giá + danh sách)',
  cong: 'Thẻ nhiều mức giá',
  bang: 'Bảng giá dạng bảng',
  anh: 'Ảnh bảng giá',
};

const lines = (arr?: string[]) => (arr || []).join('\n');
const toLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export default function BangGiaEditor({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const [muc, setMuc] = useState<any[]>(data?.muc || []);
  const [tom, setTom] = useState<any[]>(data?.tom_tat_trang_chu || []);
  const [dirty, setDirty] = useState(false);
  const mark = () => setDirty(true);

  const save = async () => { await onSave({ ...data, muc, tom_tat_trang_chu: tom }); setDirty(false); };

  // ---- Khối (muc) ----
  const setMucField = (i: number, k: string, v: any) => { const n = [...muc]; n[i] = { ...n[i], [k]: v }; setMuc(n); mark(); };
  const moveMuc = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= muc.length) return; const n = [...muc];[n[i], n[j]] = [n[j], n[i]]; setMuc(n); mark(); };
  const delMuc = (i: number) => { if (!confirm(`Xóa khối "${muc[i].tieu_de}"?`)) return; setMuc(muc.filter((_, x) => x !== i)); mark(); };
  const addMuc = () => { setMuc([...muc, { ma: 'khoi-moi', tieu_de: 'Khối mới', kieu: 'the', goi: [] }]); mark(); };

  // gói trong khối kiểu the/cong
  const setGoi = (mi: number, gi: number, k: string, v: any) => { const n = [...muc]; const goi = [...(n[mi].goi || [])]; goi[gi] = { ...goi[gi], [k]: v }; n[mi] = { ...n[mi], goi }; setMuc(n); mark(); };
  const addGoi = (mi: number) => { const n = [...muc]; n[mi] = { ...n[mi], goi: [...(n[mi].goi || []), { ten: 'Gói mới', gia: '' }] }; setMuc(n); mark(); };
  const delGoi = (mi: number, gi: number) => { const n = [...muc]; n[mi] = { ...n[mi], goi: (n[mi].goi || []).filter((_: any, x: number) => x !== gi) }; setMuc(n); mark(); };

  // nhóm danh sách trong 1 gói (kiểu the)
  const setNhom = (mi: number, gi: number, ni: number, k: string, v: any) => {
    const n = [...muc]; const goi = [...n[mi].goi]; const nhom = [...(goi[gi].nhom || [])];
    nhom[ni] = { ...nhom[ni], [k]: v }; goi[gi] = { ...goi[gi], nhom }; n[mi] = { ...n[mi], goi }; setMuc(n); mark();
  };
  const addNhom = (mi: number, gi: number) => {
    const n = [...muc]; const goi = [...n[mi].goi]; goi[gi] = { ...goi[gi], nhom: [...(goi[gi].nhom || []), { tieu_de: '', muc: [] }] };
    n[mi] = { ...n[mi], goi }; setMuc(n); mark();
  };
  const delNhom = (mi: number, gi: number, ni: number) => {
    const n = [...muc]; const goi = [...n[mi].goi]; goi[gi] = { ...goi[gi], nhom: (goi[gi].nhom || []).filter((_: any, x: number) => x !== ni) };
    n[mi] = { ...n[mi], goi }; setMuc(n); mark();
  };

  // mức giá (kiểu cong)
  const setLC = (mi: number, gi: number, li: number, k: string, v: any) => {
    const n = [...muc]; const goi = [...n[mi].goi]; const lc = [...(goi[gi].lua_chon || [])];
    lc[li] = { ...lc[li], [k]: v }; goi[gi] = { ...goi[gi], lua_chon: lc }; n[mi] = { ...n[mi], goi }; setMuc(n); mark();
  };
  const addLC = (mi: number, gi: number) => {
    const n = [...muc]; const goi = [...n[mi].goi]; goi[gi] = { ...goi[gi], lua_chon: [...(goi[gi].lua_chon || []), { ten: '', gia: '' }] };
    n[mi] = { ...n[mi], goi }; setMuc(n); mark();
  };
  const delLC = (mi: number, gi: number, li: number) => {
    const n = [...muc]; const goi = [...n[mi].goi]; goi[gi] = { ...goi[gi], lua_chon: (goi[gi].lua_chon || []).filter((_: any, x: number) => x !== li) };
    n[mi] = { ...n[mi], goi }; setMuc(n); mark();
  };

  // dòng bảng (kiểu bang)
  const setDong = (mi: number, di: number, k: string, v: any) => { const n = [...muc]; const dong = [...(n[mi].dong || [])]; dong[di] = { ...dong[di], [k]: v }; n[mi] = { ...n[mi], dong }; setMuc(n); mark(); };
  const addDong = (mi: number) => { const n = [...muc]; n[mi] = { ...n[mi], dong: [...(n[mi].dong || []), { ten: '', gia: '' }] }; setMuc(n); mark(); };
  const delDong = (mi: number, di: number) => { const n = [...muc]; n[mi] = { ...n[mi], dong: (n[mi].dong || []).filter((_: any, x: number) => x !== di) }; setMuc(n); mark(); };

  // ảnh (kiểu anh)
  const setAnh = (mi: number, ai: number, k: string, v: any) => { const n = [...muc]; const anh = [...(n[mi].anh || [])]; anh[ai] = { ...anh[ai], [k]: v }; n[mi] = { ...n[mi], anh }; setMuc(n); mark(); };
  const addAnh = (mi: number) => { const n = [...muc]; n[mi] = { ...n[mi], anh: [...(n[mi].anh || []), { tieu_de: '', anh: '' }] }; setMuc(n); mark(); };
  const delAnh = (mi: number, ai: number) => { const n = [...muc]; n[mi] = { ...n[mi], anh: (n[mi].anh || []).filter((_: any, x: number) => x !== ai) }; setMuc(n); mark(); };

  // lưu ý
  const setLuuY = (mi: number, text: string) => setMucField(mi, 'luu_y', { ...(muc[mi].luu_y || {}), muc: toLines(text) });
  const setLuuYTitle = (mi: number, t: string) => setMucField(mi, 'luu_y', { ...(muc[mi].luu_y || {}), tieu_de: t });

  // ---- Thẻ tóm tắt trang chủ ----
  const setTomField = (i: number, k: string, v: any) => { const n = [...tom]; n[i] = { ...n[i], [k]: v }; setTom(n); mark(); };
  const addTom = () => { setTom([...tom, { ten: '', gia: '', muc: [] }]); mark(); };
  const delTom = (i: number) => { if (!confirm('Xóa thẻ này?')) return; setTom(tom.filter((_, x) => x !== i)); mark(); };

  const [openMuc, setOpenMuc] = useState<number | null>(null);

  return (
    <div className="card">
      <h2>Bảng giá</h2>
      <p className="hint" style={{ marginBottom: 12 }}>Viết <b>**chữ**</b> để in đậm trong danh sách. Bấm vào tên khối để mở ra sửa chi tiết.</p>

      {muc.map((m, mi) => (
        <div key={mi} className="card" style={{ background: '#faf7f2', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setOpenMuc(openMuc === mi ? null : mi)} style={{ flex: 1, textAlign: 'left' }}>
              {openMuc === mi ? '▼' : '▶'} <b>{m.tieu_de || '(chưa đặt)'}</b> <span className="muted">— {KIEU_LABEL[m.kieu as Kieu] || m.kieu}</span>
            </button>
            <div className="btn-row">
              <button className="btn btn--ghost btn--sm" onClick={() => moveMuc(mi, -1)} disabled={mi === 0}>↑</button>
              <button className="btn btn--ghost btn--sm" onClick={() => moveMuc(mi, 1)} disabled={mi === muc.length - 1}>↓</button>
              <button className="btn btn--danger btn--sm" onClick={() => delMuc(mi)}>Xóa</button>
            </div>
          </div>

          {openMuc === mi && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div className="field-row">
                <Field label="Mã (dùng cho link, không dấu)"><input value={m.ma || ''} onChange={(e) => setMucField(mi, 'ma', e.target.value)} /></Field>
                <Field label="Kiểu trình bày">
                  <select value={m.kieu} onChange={(e) => setMucField(mi, 'kieu', e.target.value)}>
                    {Object.entries(KIEU_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
              </div>
              <div className="field-row">
                <Field label="Chữ trên thanh chọn nhanh"><input value={m.nhan_menu || ''} onChange={(e) => setMucField(mi, 'nhan_menu', e.target.value)} /></Field>
                <Field label="Chữ nhỏ phía trên tiêu đề"><input value={m.nhan_nho || ''} onChange={(e) => setMucField(mi, 'nhan_nho', e.target.value)} /></Field>
              </div>
              <Field label="Tiêu đề"><input value={m.tieu_de || ''} onChange={(e) => setMucField(mi, 'tieu_de', e.target.value)} /></Field>
              <Field label="Mô tả ngắn"><textarea value={m.mo_ta || ''} onChange={(e) => setMucField(mi, 'mo_ta', e.target.value)} /></Field>

              {/* Kiểu the / cong: danh sách gói */}
              {(m.kieu === 'the' || m.kieu === 'cong') && (
                <div>
                  <h4 style={{ margin: '12px 0 6px' }}>Các gói</h4>
                  {(m.goi || []).map((g: any, gi: number) => (
                    <div key={gi} style={{ border: '1px dashed var(--line)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b>Gói {gi + 1}</b>
                        <button className="btn btn--danger btn--sm" onClick={() => delGoi(mi, gi)}>Xóa gói</button>
                      </div>
                      <div className="field-row">
                        <Field label="Tên gói"><input value={g.ten || ''} onChange={(e) => setGoi(mi, gi, 'ten', e.target.value)} /></Field>
                        <Field label="Dòng phụ dưới tên"><input value={g.mo_ta || ''} onChange={(e) => setGoi(mi, gi, 'mo_ta', e.target.value)} /></Field>
                      </div>
                      {m.kieu === 'the' && (
                        <div className="field-row">
                          <Field label="Giá (vd 6.000.000)"><input value={g.gia || ''} onChange={(e) => setGoi(mi, gi, 'gia', e.target.value)} /></Field>
                          <Field label="Đơn vị (vd Trọn gói)"><input value={g.don_vi || ''} onChange={(e) => setGoi(mi, gi, 'don_vi', e.target.value)} /></Field>
                        </div>
                      )}
                      <div className="field-row">
                        <Field label="Nhãn nổi bật (vd Đầy đủ nhất)"><input value={g.nhan || ''} onChange={(e) => setGoi(mi, gi, 'nhan', e.target.value)} /></Field>
                        <div className="field checkbox" style={{ marginTop: 26 }}>
                          <input type="checkbox" id={`nb-${mi}-${gi}`} checked={!!g.noi_bat} onChange={(e) => setGoi(mi, gi, 'noi_bat', e.target.checked)} />
                          <label htmlFor={`nb-${mi}-${gi}`} style={{ margin: 0 }}>Làm nổi bật</label>
                        </div>
                      </div>

                      {/* cong: mức giá */}
                      {m.kieu === 'cong' && (
                        <div style={{ marginTop: 6 }}>
                          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Các mức giá</label>
                          {(g.lua_chon || []).map((lc: any, li: number) => (
                            <div key={li} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <input placeholder="Tên" value={lc.ten || ''} onChange={(e) => setLC(mi, gi, li, 'ten', e.target.value)} style={{ flex: 1, padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 7 }} />
                              <input placeholder="Giá" value={lc.gia || ''} onChange={(e) => setLC(mi, gi, li, 'gia', e.target.value)} style={{ width: 120, padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 7 }} />
                              <label className="tag-check"><input type="checkbox" checked={!!lc.noi_bat} onChange={(e) => setLC(mi, gi, li, 'noi_bat', e.target.checked)} />đậm</label>
                              <button className="btn btn--ghost btn--sm" onClick={() => delLC(mi, gi, li)}>×</button>
                            </div>
                          ))}
                          <button className="btn btn--ghost btn--sm" style={{ marginTop: 6 }} onClick={() => addLC(mi, gi)}>+ Mức giá</button>
                        </div>
                      )}

                      {/* the: nhóm danh sách */}
                      {m.kieu === 'the' && (
                        <div style={{ marginTop: 6 }}>
                          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Nhóm danh sách</label>
                          {(g.nhom || []).map((nh: any, ni: number) => (
                            <div key={ni} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: 8, marginTop: 6 }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input placeholder="Tiêu đề nhóm (để trống nếu không cần)" value={nh.tieu_de || ''} onChange={(e) => setNhom(mi, gi, ni, 'tieu_de', e.target.value)} style={{ flex: 1, padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 7 }} />
                                <select value={nh.kieu || 'thuong'} onChange={(e) => setNhom(mi, gi, ni, 'kieu', e.target.value)} style={{ padding: '6px', border: '1px solid var(--line)', borderRadius: 7 }}>
                                  <option value="thuong">Danh sách thường</option>
                                  <option value="2cot">2 cột</option>
                                  <option value="qua">Hộp quà tặng</option>
                                </select>
                                <button className="btn btn--ghost btn--sm" onClick={() => delNhom(mi, gi, ni)}>×</button>
                              </div>
                              <textarea placeholder="Mỗi dòng 1 mục" value={lines(nh.muc)} onChange={(e) => setNhom(mi, gi, ni, 'muc', toLines(e.target.value))} style={{ width: '100%', minHeight: 60, marginTop: 6, padding: 8, border: '1px solid var(--line)', borderRadius: 7 }} />
                            </div>
                          ))}
                          <button className="btn btn--ghost btn--sm" style={{ marginTop: 6 }} onClick={() => addNhom(mi, gi)}>+ Nhóm</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="btn btn--ghost btn--sm" onClick={() => addGoi(mi)}>+ Thêm gói</button>
                </div>
              )}

              {/* Kiểu bang */}
              {m.kieu === 'bang' && (
                <div>
                  <h4 style={{ margin: '12px 0 6px' }}>Các dòng bảng giá</h4>
                  {(m.dong || []).map((d: any, di: number) => (
                    <div key={di} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <input placeholder="Tên dịch vụ" value={d.ten || ''} onChange={(e) => setDong(mi, di, 'ten', e.target.value)} style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7 }} />
                      <input placeholder="Giá" value={d.gia || ''} onChange={(e) => setDong(mi, di, 'gia', e.target.value)} style={{ width: 140, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7 }} />
                      <button className="btn btn--ghost btn--sm" onClick={() => delDong(mi, di)}>×</button>
                    </div>
                  ))}
                  <button className="btn btn--ghost btn--sm" onClick={() => addDong(mi)}>+ Thêm dòng</button>
                </div>
              )}

              {/* Kiểu anh */}
              {m.kieu === 'anh' && (
                <div>
                  <h4 style={{ margin: '12px 0 6px' }}>Ảnh bảng giá</h4>
                  {(m.anh || []).map((a: any, ai: number) => (
                    <div key={ai} style={{ border: '1px dashed var(--line)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <div className="field-row">
                        <Field label="Tiêu đề"><input value={a.tieu_de || ''} onChange={(e) => setAnh(mi, ai, 'tieu_de', e.target.value)} /></Field>
                        <Field label="Nhóm"><input value={a.nhom || ''} onChange={(e) => setAnh(mi, ai, 'nhom', e.target.value)} /></Field>
                      </div>
                      <ImageUpload label="Ảnh" value={a.anh || ''} onChange={(url) => setAnh(mi, ai, 'anh', url)} />
                      <button className="btn btn--danger btn--sm" onClick={() => delAnh(mi, ai)}>Xóa ảnh</button>
                    </div>
                  ))}
                  <button className="btn btn--ghost btn--sm" onClick={() => addAnh(mi)}>+ Thêm ảnh</button>
                </div>
              )}

              {/* Ô lưu ý */}
              <div style={{ marginTop: 12 }}>
                <Field label="Ô lưu ý — tiêu đề (không bắt buộc)"><input value={m.luu_y?.tieu_de || ''} onChange={(e) => setLuuYTitle(mi, e.target.value)} /></Field>
                <Field label="Ô lưu ý — các dòng"><textarea value={lines(m.luu_y?.muc)} onChange={(e) => setLuuY(mi, e.target.value)} /></Field>
              </div>
            </div>
          )}
        </div>
      ))}
      <button className="btn btn--ghost btn--sm" onClick={addMuc}>+ Thêm khối</button>

      {/* Thẻ tóm tắt trang chủ */}
      <h2 style={{ marginTop: 24 }}>3 thẻ giá tóm tắt ở Trang chủ</h2>
      {tom.map((t, i) => (
        <div key={i} className="card" style={{ background: '#faf7f2', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Thẻ {i + 1}</b>
            <button className="btn btn--danger btn--sm" onClick={() => delTom(i)}>Xóa</button>
          </div>
          <div className="field-row">
            <Field label="Tên"><input value={t.ten || ''} onChange={(e) => setTomField(i, 'ten', e.target.value)} /></Field>
            <Field label="Giá (vd từ 6.000.000)"><input value={t.gia || ''} onChange={(e) => setTomField(i, 'gia', e.target.value)} /></Field>
          </div>
          <div className="field-row">
            <Field label="Mô tả"><input value={t.mo_ta || ''} onChange={(e) => setTomField(i, 'mo_ta', e.target.value)} /></Field>
            <Field label="Dòng dưới giá"><input value={t.don_vi || ''} onChange={(e) => setTomField(i, 'don_vi', e.target.value)} /></Field>
          </div>
          <div className="field-row">
            <Field label="Nhãn nổi bật"><input value={t.nhan || ''} onChange={(e) => setTomField(i, 'nhan', e.target.value)} /></Field>
            <Field label="Link nút Xem chi tiết"><input value={t.link || ''} onChange={(e) => setTomField(i, 'link', e.target.value)} /></Field>
          </div>
          <div className="field checkbox">
            <input type="checkbox" id={`tom-nb-${i}`} checked={!!t.noi_bat} onChange={(e) => setTomField(i, 'noi_bat', e.target.checked)} />
            <label htmlFor={`tom-nb-${i}`} style={{ margin: 0 }}>Làm nổi bật</label>
          </div>
          <Field label="Các dòng (mỗi dòng 1 mục)"><textarea value={lines(t.muc)} onChange={(e) => setTomField(i, 'muc', toLines(e.target.value))} /></Field>
        </div>
      ))}
      <button className="btn btn--ghost btn--sm" onClick={addTom}>+ Thêm thẻ tóm tắt</button>

      <SaveBar onSave={save} dirty={dirty} />
    </div>
  );
}
