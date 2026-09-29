import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Spinner } from '../components/ui';
import LienHeEditor from './content/LienHeEditor';
import BannerEditor from './content/BannerEditor';
import NhacNenEditor from './content/NhacNenEditor';
import DoiNguEditor from './content/DoiNguEditor';
import DanhGiaEditor from './content/DanhGiaEditor';
import TuyenDungEditor from './content/TuyenDungEditor';
import JsonEditor from './content/JsonEditor';

interface RepoStatus {
  configured: boolean; hasToken: boolean; repoUrl: string; branch: string; pendingChanges: string[];
}

const TABS: { file: string; label: string; kind: string }[] = [
  { file: 'lien-he.json', label: '📞 Liên hệ', kind: 'lienhe' },
  { file: 'banner.json', label: '🖼️ Banner', kind: 'banner' },
  { file: 'doi-ngu.json', label: '👥 Đội ngũ', kind: 'doingu' },
  { file: 'danh-gia.json', label: '⭐ Đánh giá', kind: 'danhgia' },
  { file: 'tuyen-dung.json', label: '📝 Tuyển dụng', kind: 'tuyendung' },
  { file: 'nhac-nen.json', label: '🎵 Nhạc nền', kind: 'nhacnen' },
  { file: 'bang-gia.json', label: '💰 Bảng giá', kind: 'json' },
  { file: 'bo-suu-tap.json', label: '📷 Bộ sưu tập', kind: 'json' },
];

export default function Content() {
  const [tab, setTab] = useState(TABS[0]);
  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refreshStatus = () => api.get<RepoStatus>('/content/status').then(setStatus).catch(() => {});
  useEffect(() => { refreshStatus(); }, []);

  const publish = async () => {
    if (!confirm('Công bố toàn bộ thay đổi lên website? Website sẽ tự cập nhật sau khoảng 1 phút.')) return;
    setPublishing(true);
    setMsg(null);
    try {
      const r = await api.post('/content/publish', { message: 'Cập nhật nội dung website từ app quản trị' });
      setMsg({ ok: true, text: r.message + (r.changed?.length ? ` (${r.changed.length} thay đổi)` : '') });
      refreshStatus();
    } catch (e: any) {
      setMsg({ ok: false, text: 'Lỗi công bố: ' + e.message });
    } finally {
      setPublishing(false);
    }
  };

  const onSaved = () => { refreshStatus(); setMsg({ ok: true, text: 'Đã lưu bản nháp. Bấm "Công bố" để đưa lên website.' }); };

  return (
    <>
      <div className="page-head">
        <h1>Nội dung website</h1>
        <div className="btn-row">
          {status && status.pendingChanges.length > 0 && (
            <span className="badge badge--amber" style={{ alignSelf: 'center' }}>{status.pendingChanges.length} thay đổi chờ công bố</span>
          )}
          <button className="btn btn--dark" onClick={publish} disabled={publishing}>
            {publishing ? 'Đang công bố…' : '🚀 Công bố lên website'}
          </button>
        </div>
      </div>

      {status && !status.configured && (
        <div className="msg msg--err">
          Chưa cấu hình repo website (WEBSITE_REPO_URL) trong file <b>.env</b> của backend.
          Bạn vẫn sửa được nội dung, nhưng chưa đẩy lên website thật cho tới khi cấu hình.
        </div>
      )}
      {status && status.configured && !status.hasToken && (
        <div className="msg msg--err">
          Chưa có <b>GITHUB_TOKEN</b> trong .env — thay đổi chỉ lưu (commit) cục bộ, chưa đẩy lên GitHub.
        </div>
      )}
      {msg && <div className={`msg ${msg.ok ? 'msg--ok' : 'msg--err'}`}>{msg.text}</div>}

      <div className="toolbar" style={{ gap: 6 }}>
        {TABS.map((t) => (
          <button key={t.file} className={`btn btn--sm ${tab.file === t.file ? '' : 'btn--ghost'}`} onClick={() => { setTab(t); setMsg(null); }}>
            {t.label}
          </button>
        ))}
      </div>

      <Editor key={tab.file} tab={tab} onSaved={onSaved} />
    </>
  );
}

function Editor({ tab, onSaved }: { tab: { file: string; kind: string }; onSaved: () => void }) {
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
    default: return <JsonEditor {...props} file={tab.file} />;
  }
}
