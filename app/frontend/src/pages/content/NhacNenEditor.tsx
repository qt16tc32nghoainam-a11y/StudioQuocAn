import { useState } from 'react';
import { Field } from '../../components/ui';
import { SaveBar } from './SaveBar';
import { api } from '../../lib/api';

export default function NhacNenEditor({ data, onSave }: { data: any; onSave: (d: any) => Promise<void> }) {
  const [d, setD] = useState<any>({ bat: true, am_luong: 30, ...data });
  const [dirty, setDirty] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const set = (k: string, v: any) => { setD({ ...d, [k]: v }); setDirty(true); };

  const pickAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg('Đang tải…');
    try {
      const r = await api.upload<{ url: string }>('/content/upload', file);
      set('file', r.url);
      setUploadMsg('Đã tải file nhạc.');
    } catch (er: any) { setUploadMsg('Lỗi: ' + er.message); }
    finally { e.target.value = ''; }
  };

  const save = async () => { await onSave(d); setDirty(false); };

  return (
    <div className="card">
      <h2>Nhạc nền</h2>
      <div className="field checkbox">
        <input type="checkbox" id="nn-bat" checked={!!d.bat} onChange={(e) => set('bat', e.target.checked)} />
        <label htmlFor="nn-bat" style={{ margin: 0 }}>Bật nhạc nền trên website</label>
      </div>
      <Field label="File nhạc (mp3)" hint="Chỉ dùng nhạc có giấy phép. File hiện tại sẽ được website phát khi khách chạm vào trang.">
        <input value={d.file || ''} onChange={(e) => set('file', e.target.value)} placeholder="/assets/audio/nhac-nen.mp3" />
      </Field>
      <div style={{ marginBottom: 14 }}>
        <label className="btn btn--ghost btn--sm">
          Tải file nhạc lên
          <input type="file" accept="audio/*" onChange={pickAudio} style={{ display: 'none' }} />
        </label>
        {uploadMsg && <span style={{ marginLeft: 10, fontSize: 13 }} className="muted">{uploadMsg}</span>}
      </div>
      <Field label="Ghi nguồn (tên bài — tác giả)" hint="Hiện nhỏ ở chân trang website.">
        <input value={d.ghi_nguon || ''} onChange={(e) => set('ghi_nguon', e.target.value)} />
      </Field>
      <Field label="Âm lượng (%)">
        <input type="number" min={5} max={100} value={d.am_luong ?? 30} onChange={(e) => set('am_luong', Number(e.target.value))} />
      </Field>
      <SaveBar onSave={save} dirty={dirty} />
    </div>
  );
}
