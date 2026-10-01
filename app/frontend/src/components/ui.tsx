import React from 'react';

export function Modal({ title, onClose, children, footer, wide }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={`modal${wide ? ' modal--wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{title}</h3>
          <button onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner">Đang tải…</div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

const STATUS_CLASS: Record<string, string> = {
  'Đã đặt lịch': 'badge--blue',
  'Đã chụp': 'badge--amber',
  'Đang xử lý hình': 'badge--amber',
  'Chờ giao': 'badge--amber',
  'Hoàn tất': 'badge--green',
  'Đã hủy': 'badge--gray',
  'Hoạt động': 'badge--green',
  'Tạm khóa': 'badge--red',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_CLASS[status] || 'badge--gray'}`}>{status}</span>;
}

/** Định dạng tiền VND. */
export function money(n: number | null | undefined): string {
  if (!n) return '0';
  return Number(n).toLocaleString('vi-VN');
}

/** Định dạng ngày YYYY-MM-DD -> DD/MM/YYYY. */
export function dateVN(s?: string | null): string {
  if (!s) return '—';
  const d = s.slice(0, 10);
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

export type PeriodKind = 'week' | 'month' | 'year' | 'custom';
export interface PeriodState { period: PeriodKind; from: string; to: string }

/** Build query string ?period=...&from=...&to=... cho API dashboard. */
export function periodQuery(p: PeriodState): string {
  if (p.period === 'custom' && p.from && p.to) return `period=custom&from=${p.from}&to=${p.to}`;
  return `period=${p.period}`;
}

/**
 * Bộ lọc thời gian dùng chung: Tuần / Tháng / Năm / Tùy chọn (từ ngày – đến ngày).
 * Khi chọn "Tùy chọn" hiện 2 ô ngày; chỉ gọi lại khi đã nhập đủ cả 2.
 */
export function PeriodFilter({ value, onChange }: { value: PeriodState; onChange: (v: PeriodState) => void }) {
  const opts: [PeriodKind, string][] = [['week', 'Tuần'], ['month', 'Tháng'], ['year', 'Năm'], ['custom', 'Tùy chọn']];
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="segment" role="tablist" aria-label="Chọn kỳ">
        {opts.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={value.period === k} className={value.period === k ? 'active' : ''}
            onClick={() => onChange({ ...value, period: k })}>{l}</button>
        ))}
      </div>
      {value.period === 'custom' && (
        <div className="daterange">
          <input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="Từ ngày" />
          <span className="daterange__sep">→</span>
          <input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="Đến ngày" />
        </div>
      )}
    </div>
  );
}
