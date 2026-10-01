import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Notif {
  id: string; type?: string; title: string; body?: string; link?: string; is_read: boolean; created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

export default function Notifications() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [list, setList] = useState<Notif[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const loadCount = () => api.get<{ count: number }>('/notifications/unread-count').then((r) => setCount(r.count)).catch(() => {});
  const loadList = () => api.get<Notif[]>('/notifications').then(setList).catch(() => setList([]));

  // Poll số chưa đọc mỗi 60s.
  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 60000);
    return () => clearInterval(t);
  }, []);

  // Mở dropdown -> tải danh sách. Click ngoài -> đóng.
  useEffect(() => {
    if (open) loadList();
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const openNotif = async (n: Notif) => {
    if (!n.is_read) { try { await api.post(`/notifications/${n.id}/read`, {}); } catch { /* ignore */ } }
    setOpen(false);
    loadCount();
    if (n.link) nav(n.link);
  };

  const markAll = async () => {
    try { await api.post('/notifications/read-all', {}); } catch { /* ignore */ }
    setCount(0); loadList();
  };

  return (
    <div className="notif" ref={ref}>
      <button className="notif__bell" onClick={() => setOpen((v) => !v)} aria-label="Thông báo">
        🔔
        {count > 0 && <span className="notif__badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="notif__panel">
          <div className="notif__head">
            <b>Thông báo</b>
            {count > 0 && <button className="notif__mark" onClick={markAll}>Đánh dấu đã đọc</button>}
          </div>
          <div className="notif__list">
            {list === null ? (
              <div className="notif__empty">Đang tải…</div>
            ) : list.length === 0 ? (
              <div className="notif__empty">Chưa có thông báo nào.</div>
            ) : (
              list.map((n) => (
                <button key={n.id} className={`notif__item${n.is_read ? '' : ' unread'}`} onClick={() => openNotif(n)}>
                  <div className="notif__title">{n.title}</div>
                  {n.body && <div className="notif__body">{n.body}</div>}
                  <div className="notif__time">{timeAgo(n.created_at)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
