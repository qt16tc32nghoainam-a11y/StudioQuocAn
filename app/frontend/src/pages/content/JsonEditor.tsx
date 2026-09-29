import { useState } from 'react';
import { SaveBar } from './SaveBar';

/**
 * Trình sửa JSON thô cho các file cấu trúc phức tạp (bảng giá, bộ sưu tập).
 * An toàn: kiểm tra JSON hợp lệ trước khi cho lưu. Có thể mở rộng thành form riêng sau.
 */
export default function JsonEditor({ data, onSave, file }: { data: any; onSave: (d: any) => Promise<void>; file: string }) {
  const [text, setText] = useState(JSON.stringify(data, null, 2));
  const [err, setErr] = useState('');
  const [dirty, setDirty] = useState(false);

  const parsed = () => {
    try { return { ok: true, value: JSON.parse(text) }; }
    catch (e: any) { return { ok: false, error: e.message }; }
  };

  const save = async () => {
    const p = parsed();
    if (!p.ok) { setErr('JSON không hợp lệ: ' + p.error); throw new Error('JSON không hợp lệ'); }
    setErr('');
    await onSave(p.value);
    setDirty(false);
  };

  return (
    <div className="card">
      <div className="msg" style={{ background: '#fbf0d8', color: 'var(--amber)' }}>
        <b>{file}</b> — nội dung này có cấu trúc phức tạp nên đang sửa ở dạng JSON.
        Sửa cẩn thận, giữ đúng dấu ngoặc và dấu phẩy. (Có thể làm form riêng nếu bạn cần.)
      </div>
      {err && <div className="msg msg--err">{err}</div>}
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setDirty(true); }}
        spellCheck={false}
        style={{ width: '100%', minHeight: 460, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}
      />
      <SaveBar onSave={save} dirty={dirty} />
    </div>
  );
}
