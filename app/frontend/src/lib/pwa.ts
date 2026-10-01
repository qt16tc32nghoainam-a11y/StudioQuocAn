// Đăng ký service worker + xử lý nút "Cài về màn hình chính".
export function registerPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* bỏ qua nếu lỗi */ });
    });
  }

  // Bắt sự kiện cài đặt (Android/Chrome). iOS cài qua Safari > Share > Add to Home Screen.
  let deferred: any = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    showInstallButton(() => {
      deferred?.prompt();
      deferred = null;
      hideInstallButton();
    });
  });
  window.addEventListener('appinstalled', hideInstallButton);
}

function showInstallButton(onClick: () => void) {
  if (document.getElementById('pwa-install')) return;
  const btn = document.createElement('button');
  btn.id = 'pwa-install';
  btn.className = 'pwa-install';
  btn.textContent = '📲 Cài app về màn hình';
  btn.onclick = onClick;
  document.body.appendChild(btn);
}
function hideInstallButton() {
  document.getElementById('pwa-install')?.remove();
}
