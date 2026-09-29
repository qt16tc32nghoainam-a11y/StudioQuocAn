import { useState } from 'react';
import { api } from '../lib/api';
import { Field } from '../components/ui';

export default function ChangePassword() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) { setMsg({ ok: false, text: 'Mật khẩu xác nhận không khớp' }); return; }
    if (next.length < 6) { setMsg({ ok: false, text: 'Mật khẩu mới phải từ 6 ký tự' }); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { current_password: cur, new_password: next });
      setMsg({ ok: true, text: 'Đã đổi mật khẩu thành công.' });
      setCur(''); setNext(''); setConfirm('');
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <h2>Đổi mật khẩu</h2>
      {msg && <div className={`msg ${msg.ok ? 'msg--ok' : 'msg--err'}`}>{msg.text}</div>}
      <form onSubmit={submit}>
        <Field label="Mật khẩu hiện tại"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label="Mật khẩu mới"><input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="Xác nhận mật khẩu mới"><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <button className="btn" disabled={busy}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</button>
      </form>
    </div>
  );
}
