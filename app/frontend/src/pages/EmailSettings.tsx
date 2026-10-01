import { useEffect, useState } from 'react';
import { api, getToken } from '../lib/api';
import { Field, Spinner } from '../components/ui';

interface SmtpStatus {
  host: string; port: number; secure: boolean; user: string;
  fromName: string; fromEmail: string; enabled: boolean;
  passwordConfigured: boolean; ready: boolean;
}
interface OutboxRow { id: string; recipient: string; subject: string; status: string; attempts: number; last_error?: string; created_at: string; }

export default function EmailSettings() {
  const [s, setS] = useState<SmtpStatus | null>(null);
  const [pass, setPass] = useState('');
  const [testTo, setTestTo] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [obCounts, setObCounts] = useState<{ status: string; n: number }[]>([]);
  const [obFilter, setObFilter] = useState('');

  const load = () => api.get<SmtpStatus>('/settings/smtp').then((d) => { setS(d); setTestTo((t) => t || d.fromEmail || ''); }).catch(() => {});
  const loadOutbox = () => api.get<{ rows: OutboxRow[]; counts: any[] }>(`/settings/outbox${obFilter ? `?status=${obFilter}` : ''}`).then((d) => { setOutbox(d.rows); setObCounts(d.counts); }).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { loadOutbox(); }, [obFilter]);

  const retryOne = async (id: string) => { try { await api.post(`/settings/outbox/${id}/retry`, {}); setTimeout(loadOutbox, 800); } catch (e: any) { alert(e.message); } };
  const retryAll = async () => { try { await api.post('/settings/outbox/retry-all', {}); setTimeout(loadOutbox, 800); } catch (e: any) { alert(e.message); } };

  // Tải file (backup .db / export JSON) kèm token qua fetch rồi mở blob.
  const download = async (path: string) => {
    setBusy(true);
    try {
      const resp = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!resp.ok) throw new Error('Tải thất bại');
      const blob = await resp.blob();
      const dispo = resp.headers.get('Content-Disposition') || '';
      const m = dispo.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = m ? m[1] : 'download';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

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
    <div style={{ display: 'grid', gap: 20, maxWidth: 760 }}>
    <div className="card">
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

    {/* Hàng đợi email: xem & gửi lại email lỗi */}
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Email đã gửi / lỗi</h2>
        <button className="btn btn--ghost btn--sm" onClick={retryAll}>Gửi lại tất cả lỗi</button>
      </div>
      <div className="toolbar" style={{ marginTop: 10 }}>
        {[['', 'Tất cả'], ['failed', 'Lỗi'], ['pending', 'Chờ gửi'], ['sent', 'Đã gửi']].map(([k, l]) => (
          <button key={k} className={`btn btn--sm ${obFilter === k ? '' : 'btn--ghost'}`} onClick={() => setObFilter(k)}>{l}
            {obCounts.find((c) => c.status === k) ? ` (${obCounts.find((c) => c.status === k)!.n})` : ''}</button>
        ))}
      </div>
      {outbox.length === 0 ? <p className="muted" style={{ fontSize: 13.5 }}>Không có email nào.</p> : (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table>
            <thead><tr><th>Người nhận</th><th>Tiêu đề</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {outbox.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontSize: 13 }}>{m.recipient}</td>
                  <td style={{ fontSize: 13 }}>{m.subject}
                    {m.status === 'failed' && m.last_error && <div style={{ color: 'var(--red)', fontSize: 11.5 }}>{m.last_error}</div>}</td>
                  <td>
                    {m.status === 'sent' ? <span className="badge badge--green">Đã gửi</span>
                      : m.status === 'failed' ? <span className="badge" style={{ background: '#fdecea', color: 'var(--red)' }}>Lỗi ({m.attempts})</span>
                      : <span className="badge badge--amber">Chờ gửi</span>}
                  </td>
                  <td>{m.status !== 'sent' && <button className="btn btn--ghost btn--sm" onClick={() => retryOne(m.id)}>Gửi lại</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* Sao lưu dữ liệu */}
    <div className="card">
      <h2>Sao lưu dữ liệu</h2>
      <p className="hint" style={{ marginBottom: 12 }}>Tải bản sao toàn bộ dữ liệu để lưu trữ an toàn. Nên sao lưu định kỳ.</p>
      <div className="btn-row">
        <button className="btn" onClick={() => download('/settings/backup')} disabled={busy}>⬇ Tải file database (.db)</button>
        <button className="btn btn--ghost" onClick={() => download('/settings/export')} disabled={busy}>⬇ Xuất dữ liệu (JSON)</button>
      </div>
    </div>
    </div>
  );
}
