import { useState } from 'react';
import { api } from '../lib/api';
import { websiteImg } from '../lib/assets';

/** Ô nhập ảnh: hiện ảnh hiện tại + nút tải ảnh mới (upload lên assets/uploads của repo website). */
export default function ImageUpload({ value, onChange, label }: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const r = await api.upload<{ url: string }>('/content/upload', file);
      onChange(r.url);
    } catch (er: any) { setErr(er.message); }
    finally { setBusy(false); e.target.value = ''; }
  };

  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {value ? <img src={websiteImg(value)} className="thumb" alt="" style={{ width: 60, height: 60 }} onError={(e) => (e.currentTarget.style.display = 'none')} /> : <span className="muted" style={{ fontSize: 13 }}>Chưa có ảnh</span>}
        <label className="btn btn--ghost btn--sm" style={{ display: 'inline-block' }}>
          {busy ? 'Đang tải…' : 'Tải ảnh'}
          <input type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} disabled={busy} />
        </label>
        {value && <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange('')}>Bỏ ảnh</button>}
      </div>
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="hoặc dán đường dẫn ảnh…" style={{ marginTop: 6 }} />
      {err && <div className="hint" style={{ color: 'var(--red)' }}>{err}</div>}
    </div>
  );
}
