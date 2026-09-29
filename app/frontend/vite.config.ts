import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Trong dev, proxy /api sang backend (cổng 4100) để tránh CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:4100',
    },
  },
  build: {
    outDir: 'dist',
  },
});
