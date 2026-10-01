import { useState } from 'react';

/** Thanh nút Lưu bản nháp dùng chung cho các editor nội dung (dính đáy, luôn thấy). */
export function SaveBar({ onSave, dirty }: { onSave: () => Promise<void>; dirty: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const doSave = async () => {
    setBusy(true); setMsg('');
    try { await onSave(); setMsg('✓ Đã lưu'); }
    catch (e: any) { setMsg('Lỗi: ' + e.message); }
    finally { setBusy(false); }
  };
  return (
    <div style={{
      position: 'sticky', bottom: 0, background: 'var(--panel)', borderTop: '2px solid var(--gold)',
      padding: '14px 16px', margin: '18px -18px -18px', borderRadius: '0 0 12px 12px',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: '0 -4px 12px rgba(40,30,20,.06)',
    }}>
      <button className="btn" onClick={doSave} disabled={busy} style={{ minWidth: 150 }}>
        {busy ? 'Đang lưu…' : '💾 Lưu bản nháp'}
      </button>
      {dirty && !msg && <span className="badge badge--amber">Có thay đổi chưa lưu</span>}
      {msg && <span className="badge" style={{ background: msg.startsWith('Lỗi') ? '#fae0dc' : '#dcf1e6', color: msg.startsWith('Lỗi') ? 'var(--red)' : 'var(--green)' }}>{msg}</span>}
      <span className="hint" style={{ marginLeft: 'auto' }}>Lưu xong → bấm <b>Công bố lên website</b> ở trên cùng để khách thấy.</span>
    </div>
  );
}
