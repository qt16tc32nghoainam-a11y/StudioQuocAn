import { useState } from 'react';
import { Modal, Field } from '../../components/ui';
import ImageUpload from '../../components/ImageUpload';
import { api } from '../../lib/api';
import { SaveBar } from './SaveBar';

/**
 * Editor Bộ sưu tập.
 *
 * Cấu trúc bo-suu-tap.json: { danh_muc[], album[], anh_dep{} }
 *  - album.nguon = "thu-muc": album do tool Python quét từ thư mục ảnh -> CHỈ ĐỌC ở đây
 *    (mỗi lần chạy CAP NHAT WEB.bat sẽ dựng lại đè, nên sửa ở app là vô nghĩa).
 *  - album.nguon = "cms": album thêm qua app, ảnh nằm trong assets/uploads -> tool Python giữ nguyên.
 *  - danh_muc[] và anh_dep{}: giữ nguyên, không đụng khi lưu.
 */
interface Album {
  danh_muc: string;
  ten: string;
  ngay?: string;
  anh_bia?: string;
  anh: string[];
  nguon?: string;
}
interface DanhMuc { ma: string; ten: string; }

export default function BoSuuTapEditor({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const danhMuc: DanhMuc[] = data?.danh_muc || [];
  const [albums, setAlbums] = useState<Album[]>(data?.album || []);
  const [dirty, setDirty] = useState(false);
  const [edit, setEdit] = useState<{ album: Album; index: number } | null>(null);
  const [filter, setFilter] = useState('all');
  const [err, setErr] = useState('');

  const tenDanhMuc = (ma: string) => danhMuc.find((d) => d.ma === ma)?.ten || ma;

  const change = (v: Album[]) => { setAlbums(v); setDirty(true); };

  const openNew = () => {
    setErr('');
    setEdit({ index: -1, album: { danh_muc: danhMuc[0]?.ma || '', ten: '', ngay: new Date().toISOString().slice(0, 10), anh_bia: '', anh: [], nguon: 'cms' } });
  };
  const openEdit = (a: Album, i: number) => { setErr(''); setEdit({ index: i, album: { ...a, anh: [...(a.anh || [])] } }); };

  const saveAlbum = () => {
    if (!edit) return;
    const a = edit.album;
    if (!a.ten.trim()) { setErr('Nhập tên album'); return; }
    if (!a.danh_muc) { setErr('Chọn danh mục'); return; }
    if (a.anh.length === 0) { setErr('Thêm ít nhất 1 ảnh'); return; }
    if (!a.anh_bia) a.anh_bia = a.anh[0];
    const next = [...albums];
    if (edit.index === -1) next.push(a);
    else next[edit.index] = a;
    change(next);
    setEdit(null);
  };

  const removeAlbum = (i: number) => {
    if (!confirm(`Xóa album "${albums[i].ten}"?`)) return;
    change(albums.filter((_, x) => x !== i));
  };

  const save = async () => { await onSave({ ...data, album: albums }); setDirty(false); };

  // Ảnh trong modal
  const addPhoto = (url: string) => { if (!edit || !url) return; setEdit({ ...edit, album: { ...edit.album, anh: [...edit.album.anh, url] } }); };
  const delPhoto = (i: number) => { if (!edit) return; setEdit({ ...edit, album: { ...edit.album, anh: edit.album.anh.filter((_, x) => x !== i) } }); };
  const movePhoto = (i: number, dir: -1 | 1) => {
    if (!edit) return; const arr = [...edit.album.anh]; const j = i + dir;
    if (j < 0 || j >= arr.length) return;[arr[i], arr[j]] = [arr[j], arr[i]];
    setEdit({ ...edit, album: { ...edit.album, anh: arr } });
  };

  const shown = albums
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => filter === 'all' || a.danh_muc === filter);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Bộ sưu tập ({albums.length} album)</h2>
        <button className="btn" onClick={openNew}>+ Thêm album</button>
      </div>

      <div className="msg" style={{ background: '#e3eefa', color: 'var(--blue)', marginTop: 12 }}>
        Album gắn nhãn <b>Từ thư mục</b> do công cụ trên máy quét ảnh tạo ra — sửa ở đây sẽ bị ghi đè
        khi chạy lại công cụ, nên chỉ <b>xem</b>. Album bạn <b>thêm mới ở đây</b> (tải ảnh lên) sẽ luôn được giữ.
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tất cả danh mục</option>
          {danhMuc.map((d) => <option key={d.ma} value={d.ma}>{d.ten}</option>)}
        </select>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {shown.map(({ a, i }) => {
          const fromFolder = a.nguon === 'thu-muc';
          return (
            <div key={i} className="card" style={{ background: '#faf7f2', padding: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <img src={a.anh_bia || a.anh?.[0]} className="thumb" style={{ width: 56, height: 74 }} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.ten}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>{tenDanhMuc(a.danh_muc)} · {a.anh?.length || 0} ảnh</div>
                  <span className={`badge ${fromFolder ? 'badge--gray' : 'badge--green'}`} style={{ marginTop: 4, fontSize: 11 }}>
                    {fromFolder ? 'Từ thư mục' : 'Thêm ở app'}
                  </span>
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 10 }}>
                {fromFolder ? (
                  <button className="btn btn--ghost btn--sm" onClick={() => openEdit(a, i)}>Xem</button>
                ) : (
                  <>
                    <button className="btn btn--ghost btn--sm" onClick={() => openEdit(a, i)}>Sửa</button>
                    <button className="btn btn--danger btn--sm" onClick={() => removeAlbum(i)}>Xóa</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="muted">Chưa có album trong danh mục này.</p>}
      </div>

      {edit && (() => {
        const readOnly = edit.album.nguon === 'thu-muc';
        return (
          <Modal
            title={edit.index === -1 ? 'Thêm album' : readOnly ? `Xem album (từ thư mục)` : 'Sửa album'}
            onClose={() => setEdit(null)}
            wide
            footer={readOnly
              ? <button className="btn btn--ghost" onClick={() => setEdit(null)}>Đóng</button>
              : <>
                <button className="btn btn--ghost" onClick={() => setEdit(null)}>Hủy</button>
                <button className="btn" onClick={saveAlbum}>Lưu album</button>
              </>}
          >
            {err && <div className="msg msg--err">{err}</div>}
            {readOnly && <div className="msg" style={{ background: '#eee6da', color: '#7a6d5c' }}>Album này do công cụ trên máy tạo — chỉ xem, không sửa ở đây.</div>}

            <div className="field-row">
              <Field label="Danh mục">
                <select value={edit.album.danh_muc} disabled={readOnly} onChange={(e) => setEdit({ ...edit, album: { ...edit.album, danh_muc: e.target.value } })}>
                  {danhMuc.map((d) => <option key={d.ma} value={d.ma}>{d.ten}</option>)}
                </select>
              </Field>
              <Field label="Ngày chụp" hint="Album xếp từ cũ đến mới theo ngày này.">
                <input type="date" value={(edit.album.ngay || '').slice(0, 10)} disabled={readOnly} onChange={(e) => setEdit({ ...edit, album: { ...edit.album, ngay: e.target.value } })} />
              </Field>
            </div>
            <Field label="Tên album" hint="Cặp đôi ghi: TÊN CHÚ RỂ & TÊN CÔ DÂU.">
              <input value={edit.album.ten} disabled={readOnly} onChange={(e) => setEdit({ ...edit, album: { ...edit.album, ten: e.target.value } })} />
            </Field>

            {!readOnly && (
              <div style={{ margin: '10px 0' }}>
                <label style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Thêm ảnh vào album</label>
                <ImageUpload label="" value="" onChange={addPhoto} />
                <p className="hint">Tải từng ảnh; ảnh sẽ hiện bên dưới. Ảnh đầu tiên mặc định là ảnh bìa.</p>
              </div>
            )}

            <label style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>Ảnh trong album ({edit.album.anh.length})</label>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', marginTop: 8 }}>
              {edit.album.anh.map((url, i) => (
                <div key={i} style={{ position: 'relative', border: (edit.album.anh_bia || edit.album.anh[0]) === url ? '2px solid var(--gold)' : '1px solid var(--line)', borderRadius: 8, padding: 4 }}>
                  <img src={url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                  {(edit.album.anh_bia || edit.album.anh[0]) === url && <span className="badge badge--amber" style={{ position: 'absolute', top: 6, left: 6, fontSize: 10 }}>Bìa</span>}
                  {!readOnly && (
                    <div className="btn-row" style={{ marginTop: 4, justifyContent: 'center' }}>
                      <button className="btn btn--ghost btn--sm" title="Sang trái" onClick={() => movePhoto(i, -1)} disabled={i === 0}>‹</button>
                      <button className="btn btn--ghost btn--sm" title="Đặt làm bìa" onClick={() => setEdit({ ...edit, album: { ...edit.album, anh_bia: url } })}>Bìa</button>
                      <button className="btn btn--ghost btn--sm" title="Sang phải" onClick={() => movePhoto(i, 1)} disabled={i === edit.album.anh.length - 1}>›</button>
                      <button className="btn btn--danger btn--sm" onClick={() => delPhoto(i)}>×</button>
                    </div>
                  )}
                </div>
              ))}
              {edit.album.anh.length === 0 && <p className="muted">Chưa có ảnh.</p>}
            </div>
          </Modal>
        );
      })()}

      <SaveBar onSave={save} dirty={dirty} />
    </div>
  );
}
