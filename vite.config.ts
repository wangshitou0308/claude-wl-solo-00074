import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 纯前端构建；不使用任何外部服务，资料仅存本机 IndexedDB
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
});
