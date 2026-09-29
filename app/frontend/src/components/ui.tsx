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
