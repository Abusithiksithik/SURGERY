import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5000';
  return {
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
server: {
  host: '0.0.0.0',
  port: 6123,
  strictPort: true,

  proxy: {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
    },
    '/uploads': {
      target: apiTarget,
      changeOrigin: true,
    },
  },
},
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  };
});