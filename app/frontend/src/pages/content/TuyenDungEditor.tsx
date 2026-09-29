import { useState } from 'react';
import { Field } from '../../components/ui';
import { SaveBar } from './SaveBar';

/** Editor tuyển dụng: mỗi vị trí có tên, danh sách nhãn, và các nhóm nội dung (mô tả/yêu cầu/quyền lợi). */
export default function TuyenDungEditor({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const [vl, setVl] = useState<any[]>(data?.viec_lam || []);
  const [dirty, setDirty] = useState(false);
  const change = (v: any[]) => { setVl(v); setDirty(true); };

  const setJob = (i: number, k: string, val: any) => { const n = [...vl]; n[i] = { ...n[i], [k]: val }; change(n); };
  const addJob = () => change([...vl, { ten: '', nhan: [], nhom: [] }]);
  const delJob = (i: number) => { if (!confirm('Xóa vị trí này?')) return; change(vl.filter((_, x) => x !== i)); };

  // nhãn
  const addTag = (i: number) => setJob(i, 'nhan', [...(vl[i].nhan || []), { chu: '', noi_bat: false }]);
  const setTag = (i: number, j: number, k: string, val: any) => {
    const nhan = [...(vl[i].nhan || [])]; nhan[j] = { ...nhan[j], [k]: val }; setJob(i, 'nhan', nhan);
  };
  const delTag = (i: number, j: number) => setJob(i, 'nhan', (vl[i].nhan || []).filter((_: any, x: number) => x !== j));

  // nhóm nội dung
  const addGroup = (i: number) => setJob(i, 'nhom', [...(vl[i].nhom || []), { tieu_de: '', muc: [] }]);
  const setGroup = (i: number, g: number, k: string, val: any) => {
    const nhom = [...(vl[i].nhom || [])]; nhom[g] = { ...nhom[g], [k]: val }; setJob(i, 'nhom', nhom);
  };
  const delGroup = (i: number, g: number) => setJob(i, 'nhom', (vl[i].nhom || []).filter((_: any, x: number) => x !== g));
  const setLines = (i: number, g: number, text: string) => setGroup(i, g, 'muc', text.split('\n').filter((x) => x.trim() !== ''));

  const save = async () => { await onSave({ ...data, viec_lam: vl }); setDirty(false); };

  return (
    <div className="card">
      <h2>Tuyển dụng</h2>
      {vl.length === 0 && <p className="muted">Chưa có vị trí tuyển dụng.</p>}
      {vl.map((v, i) => (
        <div key={i} className="card" style={{ background: '#faf7f2', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <b>Vị trí {i + 1}</b>
            <button className="btn btn--danger btn--sm" onClick={() => delJob(i)}>Xóa vị trí</button>
          </div>
          <Field label="Tên vị trí"><input value={v.ten || ''} onChange={(e) => setJob(i, 'ten', e.target.value)} /></Field>

          <label style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>Nhãn (số lượng, lương, hình thức…)</label>
          {(v.nhan || []).map((n: any, j: number) => (
            <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input value={n.chu || ''} onChange={(e) => setTag(i, j, 'chu', e.target.value)} style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
              <label className="tag-check"><input type="checkbox" checked={!!n.noi_bat} onChange={(e) => setTag(i, j, 'noi_bat', e.target.checked)} /> tô đỏ</label>
              <button className="btn btn--ghost btn--sm" onClick={() => delTag(i, j)}>×</button>
            </div>
          ))}
          <button className="btn btn--ghost btn--sm" onClick={() => addTag(i)} style={{ marginBottom: 12 }}>+ Nhãn</button>

          <label style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>Nội dung (Mô tả / Yêu cầu / Quyền lợi…)</label>
          {(v.nhom || []).map((g: any, gi: number) => (
            <div key={gi} style={{ border: '1px dashed var(--line)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input placeholder="Tiêu đề nhóm" value={g.tieu_de || ''} onChange={(e) => setGroup(i, gi, 'tieu_de', e.target.value)} style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
                <button className="btn btn--ghost btn--sm" onClick={() => delGroup(i, gi)}>Xóa nhóm</button>
              </div>
              <textarea placeholder="Mỗi dòng là một mục" value={(g.muc || []).join('\n')} onChange={(e) => setLines(i, gi, e.target.value)} style={{ width: '100%', minHeight: 80, padding: 10, border: '1px solid var(--line)', borderRadius: 8 }} />
            </div>
          ))}
          <button className="btn btn--ghost btn--sm" onClick={() => addGroup(i)}>+ Nhóm nội dung</button>
        </div>
      ))}
      <button className="btn btn--ghost btn--sm" onClick={addJob}>+ Thêm vị trí</button>
      <SaveBar onSave={save} dirty={dirty} />
    </div>
  );
}
