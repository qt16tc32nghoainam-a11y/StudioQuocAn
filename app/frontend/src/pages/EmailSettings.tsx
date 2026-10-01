import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Field, Spinner } from '../components/ui';

interface SmtpStatus {
  host: string; port: number; secure: boolean; user: string;
  fromName: string; fromEmail: string; enabled: boolean;
  passwordConfigured: boolean; ready: boolean;
}

export default function EmailSettings() {
  const [s, setS] = useState<SmtpStatus | null>(null);
  const [pass, setPass] = useState('');
  const [testTo, setTestTo] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get<SmtpStatus>('/settings/smtp').then((d) => { setS(d); setTestTo((t) => t || d.fromEmail || ''); }).catch(() => {});
  useEffect(() => { load(); }, []);

  if (!s) return <Spinner />;

  const set = (k: keyof SmtpStatus, v: any) => setS({ ...s, [k]: v });

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body: any = { host: s.host, port: s.port, secure: s.secure, user: s.user, fromName: s.fromName, fromEmail: s.fromEmail, enabled: s.enabled };
      if (pass) body.pass = pass;
      const r = await api.put('/settings/smtp', body);
      setS(r.status); setPass('');
      setMsg({ ok: true, text: 'Đã lưu cấu hình SMTP.' });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  const testConn = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api.post('/settings/smtp/test'); setMsg({ ok: true, text: r.message }); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  const sendTest = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api.post('/settings/smtp/send-test', { to: testTo }); setMsg({ ok: true, text: r.message }); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>Cấu hình email (SMTP)</h2>
      <p className="hint" style={{ marginBottom: 14 }}>
        Dùng để gửi email tự động cho nhân viên khi được phân công lịch chụp.
        Gmail: host <b>smtp.gmail.com</b>, cổng <b>587</b>, dùng <b>Mật khẩu ứng dụng</b> (không phải mật khẩu đăng nhập).
      </p>
      {msg && <div className={`msg ${msg.ok ? 'msg--ok' : 'msg--err'}`}>{msg.text}</div>}

      <div className="field checkbox">
        <input type="checkbox" id="smtp-on" checked={s.enabled} onChange={(e) => set('enabled', e.target.checked)} />
        <label htmlFor="smtp-on" style={{ margin: 0 }}>Bật gửi email</label>
      </div>

      <div className="field-row">
        <Field label="Máy chủ SMTP (host)"><input value={s.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.gmail.com" /></Field>
        <Field label="Cổng (port)"><input type="number" value={s.port} onChange={(e) => set('port', Number(e.target.value))} placeholder="587" /></Field>
      </div>
      <div className="field checkbox">
        <input type="checkbox" id="smtp-secure" checked={s.secure} onChange={(e) => set('secure', e.target.checked)} />
        <label htmlFor="smtp-secure" style={{ margin: 0 }}>Dùng SSL (bật nếu cổng 465)</label>
      </div>
      <Field label="Tài khoản (user / email đăng nhập SMTP)"><input value={s.user} onChange={(e) => set('user', e.target.value)} placeholder="quocan6339@gmail.com" /></Field>
      <Field label="Mật khẩu SMTP" hint={s.passwordConfigured ? 'Đã lưu mật khẩu. Để trống nếu không đổi.' : 'Chưa có mật khẩu. Nhập mật khẩu ứng dụng.'}>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={s.passwordConfigured ? '•••••••• (giữ nguyên)' : 'Nhập mật khẩu'} />
      </Field>
      <div className="field-row">
        <Field label="Tên người gửi"><input value={s.fromName} onChange={(e) => set('fromName', e.target.value)} placeholder="Quốc An Studio" /></Field>
        <Field label="Email người gửi (from)"><input value={s.fromEmail} onChange={(e) => set('fromEmail', e.target.value)} placeholder="quocan6339@gmail.com" /></Field>
      </div>

      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={save} disabled={busy}>Lưu cấu hình</button>
        <button className="btn btn--ghost" onClick={testConn} disabled={busy}>Kiểm tra kết nối</button>
      </div>

      <div style={{ marginTop: 20, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        <Field label="Gửi email thử tới">
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="email@domain.com" style={{ flex: 1 }} />
            <button className="btn btn--ghost" onClick={sendTest} disabled={busy}>Gửi thử</button>
          </div>
        </Field>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>Trạng thái: {s.ready ? <b style={{ color: 'var(--green)' }}>Sẵn sàng gửi</b> : <b style={{ color: 'var(--amber)' }}>Chưa sẵn sàng (cần bật + điền đủ host, user, mật khẩu)</b>}</p>
    </div>
  );
}
