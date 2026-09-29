import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal, Field, money, dateVN } from './ui';

interface Payment {
  id: string; shoot_id: string; ngay: string; so_tien: number; loai: string; phuong_thuc?: string; note?: string;
}

/** Quản lý thu tiền / đặt cọc cho 1 buổi chụp. Chỉ Admin dùng. */
export default function PaymentsModal({ shootId, shootLabel, onClose, onChanged }: {
  shootId: string; shootLabel: string; onClose: () => void; onChanged?: () => void;
}) {
  const [data, setData] = useState<{ payments: Payment[]; total: number; paid: number; remaining: number } | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [form, setForm] = useState<Partial<Payment> | null>(null);
  const [err, setErr] = useState('');

  const load = () => api.get(`/payments/shoot/${shootId}`).then(setData).catch(() => {});
  useEffect(() => { load(); api.get('/meta/options').then((o) => { setTypes(o.paymentTypes || []); setMethods(o.paymentMethods || []); }).catch(() => {}); }, [shootId]);

  const save = async () => {
    if (!form?.so_tien || Number(form.so_tien) <= 0) { setErr('Nhập số tiền'); return; }
    setErr('');
    try {
      if (form.id) await api.put(`/payments/${form.id}`, form);
      else await api.post('/payments', { ...form, shoot_id: shootId });
      setForm(null); await load(); onChanged?.();
    } catch (e: any) { setErr(e.message); }
  };
  const remove = async (p: Payment) => {
    if (!confirm('Xóa khoản thu này?')) return;
    try { await api.del(`/payments/${p.id}`); await load(); onChanged?.(); } catch (e: any) { alert(e.message); }
  };

  return (
    <Modal title={`Thu tiền / đặt cọc — ${shootLabel}`} onClose={onClose} wide>
      {data && (
        <div className="grid stat-grid" style={{ marginBottom: 16 }}>
          <div className="card stat"><span className="n">{money(data.total)}</span><span className="l">Tổng tiền</span></div>
          <div className="card stat"><span className="n" style={{ color: 'var(--green)' }}>{money(data.paid)}</span><span className="l">Đã thu</span></div>
          <div className="card stat"><span className="n" style={{ color: data.remaining > 0 ? 'var(--red)' : 'var(--green)' }}>{money(data.remaining)}</span><span className="l">Còn lại</span></div>
        </div>
      )}

      {err && <div className="msg msg--err">{err}</div>}

      {!form ? (
        <button className="btn btn--sm" style={{ marginBottom: 12 }} onClick={() => { setForm({ ngay: new Date().toISOString().slice(0, 10), loai: 'Đặt cọc' }); setErr(''); }}>+ Thêm khoản thu</button>
      ) : (
        <div className="card" style={{ background: '#faf7f2', marginBottom: 12 }}>
          <div className="field-row">
            <Field label="Ngày thu"><input type="date" value={(form.ngay || '').slice(0, 10)} onChange={(e) => setForm({ ...form, ngay: e.target.value })} /></Field>
            <Field label="Số tiền (đ)"><input type="number" value={form.so_tien ?? ''} onChange={(e) => setForm({ ...form, so_tien: Number(e.target.value) })} /></Field>
          </div>
          <div className="field-row">
            <Field label="Loại">
              <select value={form.loai || 'Đặt cọc'} onChange={(e) => setForm({ ...form, loai: e.target.value })}>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Phương thức">
              <select value={form.phuong_thuc || ''} onChange={(e) => setForm({ ...form, phuong_thuc: e.target.value })}>
                <option value="">— Chọn —</option>
                {methods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Ghi chú"><input value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="btn-row">
            <button className="btn btn--sm" onClick={save}>Lưu khoản thu</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setForm(null)}>Hủy</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Ngày</th><th>Loại</th><th>Số tiền</th><th>Phương thức</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody>
            {(data?.payments || []).map((p) => (
              <tr key={p.id}>
                <td>{dateVN(p.ngay)}</td>
                <td>{p.loai}</td>
                <td style={{ color: 'var(--green)', fontWeight: 600 }}>{money(p.so_tien)}</td>
                <td className="muted">{p.phuong_thuc || '—'}</td>
                <td className="muted">{p.note || '—'}</td>
                <td>
                  <div className="btn-row">
                    <button className="btn btn--ghost btn--sm" onClick={() => { setForm(p); setErr(''); }}>Sửa</button>
                    <button className="btn btn--danger btn--sm" onClick={() => remove(p)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
            {data && data.payments.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Chưa có khoản thu nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
