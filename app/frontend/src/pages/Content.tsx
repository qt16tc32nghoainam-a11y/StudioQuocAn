import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Spinner } from '../components/ui';
import LienHeEditor from './content/LienHeEditor';
import BannerEditor from './content/BannerEditor';
import NhacNenEditor from './content/NhacNenEditor';
import DoiNguEditor from './content/DoiNguEditor';
import DanhGiaEditor from './content/DanhGiaEditor';
import TuyenDungEditor from './content/TuyenDungEditor';
import BoSuuTapEditor from './content/BoSuuTapEditor';
import BangGiaEditor from './content/BangGiaEditor';
import JsonEditor from './content/JsonEditor';

interface RepoStatus {
  configured: boolean; hasToken: boolean; repoUrl: string; branch: string; pendingChanges: string[];
}

interface TabDef { file: string; title: string; icon: string; desc: string; kind: string; }

// Mỗi mục có mô tả rõ "sửa cái này đổi gì trên web" -> nhìn là biết bấm vào đâu.
const TABS: TabDef[] = [
  { file: 'lien-he.json', title: 'Liên hệ', icon: '📞', kind: 'lienhe', desc: 'Địa chỉ, hotline, Zalo, email, giờ mở cửa, tài khoản ngân hàng + mã QR.' },
  { file: 'banner.json', title: 'Ảnh banner', icon: '🖼️', kind: 'banner', desc: 'Các ảnh lớn chạy ở đầu trang chủ website.' },
  { file: 'bang-gia.json', title: 'Bảng giá', icon: '💰', kind: 'banggia', desc: 'Các gói chụp, giá tiền, khuyến mãi, bảng giá tiệc.' },
  { file: 'bo-suu-tap.json', title: 'Bộ sưu tập', icon: '📷', kind: 'bosuutap', desc: 'Album ảnh cưới theo danh mục. Thêm/sửa/xóa album, tải ảnh.' },
  { file: 'doi-ngu.json', title: 'Đội ngũ', icon: '👥', kind: 'doingu', desc: 'Thành viên studio: ảnh, tên, chức danh, Facebook.' },
  { file: 'danh-gia.json', title: 'Đánh giá', icon: '⭐', kind: 'danhgia', desc: 'Đánh giá của khách hiển thị ở trang chủ.' },
  { file: 'tuyen-dung.json', title: 'Tuyển dụng', icon: '📝', kind: 'tuyendung', desc: 'Các vị trí đang tuyển và mô tả công việc.' },
  { file: 'nhac-nen.json', title: 'Nhạc nền', icon: '🎵', kind: 'nhacnen', desc: 'Bật/tắt và chọn bài nhạc phát trên website.' },
];

export default function Content() {
  const [tab, setTab] = useState<TabDef | null>(null);
  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refreshStatus = () => api.get<RepoStatus>('/content/status').then(setStatus).catch(() => {});
  useEffect(() => { refreshStatus(); }, []);

  const pending = status?.pendingChanges?.length || 0;

  const publish = async () => {
    if (!confirm('Công bố toàn bộ thay đổi lên website? Khách sẽ thấy nội dung mới sau khoảng 1 phút.')) return;
    setPublishing(true); setMsg(null);
    try {
      const r = await api.post('/content/publish', { message: 'Cập nhật nội dung website từ app quản trị' });
      setMsg({ ok: true, text: r.message + (r.changed?.length ? ` (${r.changed.length} mục)` : '') });
      refreshStatus();
    } catch (e: any) {
      setMsg({ ok: false, text: 'Lỗi công bố: ' + e.message });
    } finally { setPublishing(false); }
  };

  const onSaved = () => { refreshStatus(); setMsg({ ok: true, text: '✓ Đã lưu. Nhớ bấm "Công bố lên website" để khách thấy thay đổi.' }); };

  return (
    <>
      {/* Thanh công bố — luôn hiện, nói rõ 2 bước */}
      <div className="publish-bar">
        <div className="publish-bar__info">
          <span className={`publish-bar__dot ${pending > 0 ? 'publish-bar__dot--dirty' : 'publish-bar__dot--clean'}`} />
          <div className="publish-bar__text">
            {pending > 0
              ? <><b>Có {pending} mục đã sửa, chưa đưa lên web</b><span>Bấm "Công bố lên website" để khách thấy.</span></>
              : <><b>Website đang là bản mới nhất</b><span>Sửa nội dung bên dưới rồi bấm Công bố.</span></>}
          </div>
        </div>
        <div className="steps">
          <span><b>1.</b> Chọn mục</span> → <span><b>2.</b> Sửa &amp; Lưu</span> → <span><b>3.</b> Công bố</span>
        </div>
        <button className="btn btn--dark" onClick={publish} disabled={publishing || pending === 0}>
          {publishing ? 'Đang công bố…' : '🚀 Công bố lên website'}
        </button>
      </div>

      {status && !status.configured && (
        <div className="msg msg--err">Chưa cấu hình kết nối website trong file .env. Bạn vẫn sửa được, nhưng chưa đẩy lên web thật.</div>
      )}
      {status && status.configured && !status.hasToken && (
        <div className="msg msg--err">Chưa có GITHUB_TOKEN — thay đổi mới lưu tạm, chưa đẩy lên web. (Xem hướng dẫn deploy)</div>
      )}
      {msg && <div className={`msg ${msg.ok ? 'msg--ok' : 'msg--err'}`}>{msg.text}</div>}

      {!tab ? (
        // Màn chọn mục: thẻ lớn, có mô tả — nhìn là biết bấm đâu
        <>
          <p className="muted" style={{ margin: '4px 0 14px', fontSize: 14 }}>Chọn phần nội dung bạn muốn sửa:</p>
          <div className="hub-grid">
            {TABS.map((t) => (
              <button key={t.file} className="hub-card" onClick={() => { setTab(t); setMsg(null); }}>
                <span className="hub-card__ic">{t.icon}</span>
                <span className="hub-card__body">
                  <span className="hub-card__title">{t.title}</span>
                  <span className="hub-card__desc">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="editor-head">
            <button className="editor-head__back" onClick={() => { setTab(null); setMsg(null); }}>‹ Tất cả mục</button>
            <h2 className="editor-head__title">{tab.icon} {tab.title}</h2>
          </div>
          <div className="guide">
            <span className="guide__ic">💡</span>
            <span>Sửa xong bấm <b>Lưu bản nháp</b> (cuối trang). Khi hài lòng tất cả, bấm <b>Công bố lên website</b> ở trên cùng — khoảng 1 phút sau khách sẽ thấy.</span>
          </div>
          <Editor key={tab.file} tab={tab} onSaved={onSaved} />
        </>
      )}
    </>
  );
}

function Editor({ tab, onSaved }: { tab: TabDef; onSaved: () => void }) {
  const [data, setData] = useState<any>(undefined);
  const [err, setErr] = useState('');

  useEffect(() => {
    setData(undefined);
    api.get(`/content/${tab.file}`).then((r) => setData(r.data ?? {})).catch((e) => setErr(e.message));
  }, [tab.file]);

  const save = async (newData: any) => {
    await api.put(`/content/${tab.file}`, { data: newData });
    onSaved();
  };

  if (err) return <div className="msg msg--err">{err}</div>;
  if (data === undefined) return <Spinner />;

  const props = { data, onSave: save };
  switch (tab.kind) {
    case 'lienhe': return <LienHeEditor {...props} />;
    case 'banner': return <BannerEditor {...props} />;
    case 'nhacnen': return <NhacNenEditor {...props} />;
    case 'doingu': return <DoiNguEditor {...props} />;
    case 'danhgia': return <DanhGiaEditor {...props} />;
    case 'tuyendung': return <TuyenDungEditor {...props} />;
    case 'bosuutap': return <BoSuuTapEditor {...props} />;
    case 'banggia': return <BangGiaEditor {...props} />;
    default: return <JsonEditor {...props} file={tab.file} />;
  }
}
