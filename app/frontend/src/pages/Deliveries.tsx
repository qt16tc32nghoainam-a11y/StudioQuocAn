import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Field, Spinner, Empty, dateVN } from '../components/ui';

interface Delivery {
  id: string; shoot_id: string; shoot_code?: string; shoot_title?: string; shoot_type?: string; shoot_date?: string;
  customer_name?: string; customer_phone?: string;
  due_date?: string; promised_date?: string; promised_notified_date?: string; editor_id?: string; editing_done?: number; editing_done_at?: string;
  delivered?: number; delivered_at?: string; delivery_method?: string; delivery_link?: string;
  photo_count?: number; note?: string;
  raw_link?: string; raw_sent?: number; raw_sent_at?: string;
}
interface Staff { id: string; full_name: string; }

export default function Deliveries() {
  const [list, setList] = useState<Delivery[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [edit, setEdit] = useState<Delivery | null>(null);
  const [err, setErr] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (filter === 'editing') params.set('editing', '0');
    if (filter === 'pending') params.set('pending', '1');
    if (filter === 'overdue') params.set('overdue', '1');
    api.get<Delivery[]>(`/deliveries?${params}`).then(setList).catch(() => setList([]));
  };
  useEffect(load, [filter]);
  useEffect(() => {
    api.get<Staff[]>('/meta/staff').then(setStaff).catch(() => {});
    api.get('/meta/options').then((o) => setMethods(o.deliveryMethods || [])).catch(() => {});
  }, []);

  const save = async () => {
    if (!edit) return;
    // Nhắc dán link (không chặn) để email cho khách có link.
    if (edit.raw_sent && !(edit.raw_link || '').trim()) {
      if (!confirm('Chưa có Link ảnh gốc. Email mời khách chọn ảnh sẽ không kèm link. Vẫn tiếp tục?')) return;
    }
    if (edit.delivered && !(edit.delivery_link || '').trim()) {
      if (!confirm('Chưa có Link ảnh hoàn thiện. Email gửi khách sẽ không kèm link tải. Vẫn tiếp tục?')) return;
    }
    setErr('');
    try {
      await api.put(`/deliveries/${edit.id}`, edit);
      setEdit(null);
      load();
    } catch (e: any) { setErr(e.message); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (d: Delivery) => { const dl = (d.promised_date || d.due_date || '').slice(0, 10); return !d.delivered && !!dl && dl < today; };
  const staffName = (id?: string) => staff.find((s) => s.id === id)?.full_name;

  const flag = (done?: number) => done
    ? <span className="badge badge--green">Xong</span>
    : <span className="badge badge--amber">Chưa</span>;

  return (
    <>
      <div className="page-head">
        <h1>Theo dõi giao hình</h1>
      </div>

      <div className="toolbar">
        {[
          ['all', 'Tất cả'], ['editing', 'Chưa làm hình'], ['pending', 'Chưa giao'], ['overdue', 'Quá hạn'],
        ].map(([k, l]) => (
          <button key={k} className={`btn btn--sm ${filter === k ? '' : 'btn--ghost'}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {!list ? <Spinner /> : list.length === 0 ? <Empty text="Không có bản ghi giao hình phù hợp." /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Mã</th><th>Khách</th><th>Ngày chụp</th><th>Hẹn giao (khách)</th><th>Gửi ảnh gốc</th><th>Làm hình</th><th>Đã giao</th><th>Ngày giao</th><th></th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td className="muted">{d.shoot_code}</td>
                  <td><b>{d.customer_name}</b><div className="muted" style={{ fontSize: 12.5 }}>{d.shoot_type || ''}</div></td>
                  <td>{dateVN(d.shoot_date)}</td>
                  <td style={isOverdue(d) ? { color: 'var(--red)', fontWeight: 600 } : {}}>{dateVN(d.promised_date || d.due_date)}</td>
                  <td>{d.raw_sent ? <span className="badge badge--green">Đã gửi</span> : <span className="badge badge--gray">—</span>}</td>
                  <td>{flag(d.editing_done)}</td>
                  <td>{flag(d.delivered)}</td>
                  <td className="muted">{dateVN(d.delivered_at)}</td>
                  <td><button className="btn btn--ghost btn--sm" onClick={() => { setEdit(d); setErr(''); }}>Cập nhật</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <Modal
          title={`Giao hình — ${edit.customer_name || ''} (${edit.shoot_code || ''})`}
          onClose={() => setEdit(null)}
          footer={<>
            <button className="btn btn--ghost" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn" onClick={save}>Lưu</button>
          </>}
        >
          {err && <div className="msg msg--err">{err}</div>}
          <div className="field-row">
            <Field label="Hạn giao (nội bộ)" hint="Mốc studio tự theo dõi, không gửi khách."><input type="date" value={edit.due_date?.slice(0, 10) || ''} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} /></Field>
            <Field label="Người làm hậu kỳ">
              <select value={edit.editor_id || ''} onChange={(e) => setEdit({ ...edit, editor_id: e.target.value })}>
                <option value="">— Chọn —</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="📅 Ngày hẹn giao ảnh (báo khách)" hint="Studio chọn ngày giao. Lưu lại sẽ tự gửi email báo khách ngày này.">
            <input type="date" value={edit.promised_date?.slice(0, 10) || ''} onChange={(e) => setEdit({ ...edit, promised_date: e.target.value })} />
          </Field>
          {edit.promised_date && edit.promised_date.slice(0, 10) !== (edit.promised_notified_date || '').slice(0, 10) && (
            <div className="guide" style={{ marginTop: 2 }}>
              <span className="guide__ic">✉️</span>
              <span>Khi lưu, hệ thống sẽ <b>gửi email báo khách ngày giao dự kiến</b> ({dateVN(edit.promised_date)}).</span>
            </div>
          )}

          {/* Bước 1: gửi ảnh gốc để khách lựa (ảnh cổng/concept). Tùy chọn — buổi tiệc có thể bỏ qua. */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, margin: '6px 0 12px' }}>
            <b style={{ fontSize: 14 }}>Bước 1 — Gửi ảnh gốc để khách lựa</b>
            <p className="hint" style={{ margin: '2px 0 10px' }}>Dùng cho ảnh cổng / concept. Buổi chỉ giao file hoàn thiện (vd tiệc) thì bỏ qua bước này.</p>
            <Field label="Link ảnh gốc"><input value={edit.raw_link || ''} onChange={(e) => setEdit({ ...edit, raw_link: e.target.value })} placeholder="https://drive.google.com/…" /></Field>
            <div className="field checkbox">
              <input type="checkbox" id="raw" checked={!!edit.raw_sent} onChange={(e) => setEdit({ ...edit, raw_sent: e.target.checked ? 1 : 0 })} />
              <label htmlFor="raw" style={{ margin: 0 }}>Đã gửi ảnh gốc cho khách lựa</label>
            </div>
            {!!edit.raw_sent && (
              <div className="guide" style={{ marginTop: 4 }}>
                <span className="guide__ic">✉️</span>
                <span>Khi lưu, hệ thống <b>gửi email mời khách chọn ảnh</b> kèm link gốc. Khách chọn xong sẽ báo lại qua Zalo.</span>
              </div>
            )}
          </div>

          {/* Bước 2: giao ảnh hoàn thiện. */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <b style={{ fontSize: 14 }}>Bước 2 — Giao ảnh hoàn thiện</b>
            <div className="field checkbox" style={{ marginTop: 8 }}>
              <input type="checkbox" id="ed" checked={!!edit.editing_done} onChange={(e) => setEdit({ ...edit, editing_done: e.target.checked ? 1 : 0 })} />
              <label htmlFor="ed" style={{ margin: 0 }}>Đã làm hình xong (hậu kỳ)</label>
            </div>
            <Field label="Link ảnh hoàn thiện"><input value={edit.delivery_link || ''} onChange={(e) => setEdit({ ...edit, delivery_link: e.target.value })} placeholder="https://drive.google.com/…" /></Field>
            <div className="field-row">
              <Field label="Số ảnh giao"><input type="number" value={edit.photo_count ?? ''} onChange={(e) => setEdit({ ...edit, photo_count: e.target.value ? Number(e.target.value) : undefined })} /></Field>
              <Field label="Cách giao">
                <select value={edit.delivery_method || ''} onChange={(e) => setEdit({ ...edit, delivery_method: e.target.value })}>
                  <option value="">— Chọn —</option>
                  {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <div className="field checkbox">
              <input type="checkbox" id="dv" checked={!!edit.delivered} onChange={(e) => setEdit({ ...edit, delivered: e.target.checked ? 1 : 0 })} />
              <label htmlFor="dv" style={{ margin: 0 }}>Đã giao ảnh hoàn thiện cho khách</label>
            </div>
            {!!edit.delivered && (
              <div className="guide" style={{ marginTop: 4 }}>
                <span className="guide__ic">✉️</span>
                <span>Khi lưu, hệ thống <b>gửi email link ảnh hoàn thiện cho khách</b>. Nhớ dán Link ảnh hoàn thiện ở trên.</span>
              </div>
            )}
          </div>

          <Field label="Ghi chú"><textarea value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
          {staffName(edit.editor_id) && <p className="hint">Hậu kỳ: {staffName(edit.editor_id)}</p>}
        </Modal>
      )}
    </>
  );
}
