import { useState } from 'react';

/** Thanh nút Lưu bản nháp dùng chung cho các editor nội dung. */
export function SaveBar({ onSave, dirty }: { onSave: () => Promise<void>; dirty: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const doSave = async () => {
    setBusy(true); setMsg('');
    try { await onSave(); setMsg('Đã lưu bản nháp'); }
    catch (e: any) { setMsg('Lỗi: ' + e.message); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'sticky', bottom: 0, background: 'var(--panel)', borderTop: '1px solid var(--line)', padding: '12px 0', marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <button className="btn" onClick={doSave} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu bản nháp'}</button>
      {dirty && <span className="muted" style={{ fontSize: 13 }}>Có thay đổi chưa lưu</span>}
      {msg && <span style={{ fontSize: 13, color: msg.startsWith('Lỗi') ? 'var(--red)' : 'var(--green)' }}>{msg}</span>}
      <span className="hint" style={{ marginLeft: 'auto' }}>Lưu xong nhớ bấm "Công bố" ở trên để đưa lên website.</span>
    </div>
  );
}
