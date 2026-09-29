// Cấu hình pm2 — chạy backend Wedding Admin, tự bật lại khi crash.
// Backend đã serve luôn frontend (app/backend/public) nên chỉ cần 1 tiến trình.
module.exports = {
  apps: [
    {
      name: 'wedding-admin',
      cwd: '/opt/wedding-admin/app/backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      // Tự khởi động lại khi crash, có giới hạn để tránh vòng lặp crash liên tục.
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      // Ghi log ra file để dễ soi khi có sự cố.
      out_file: '/var/log/wedding-admin/out.log',
      error_file: '/var/log/wedding-admin/err.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '400M',
    },
  ],
};
