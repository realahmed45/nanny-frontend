import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      // Nanny photos and videos are served by the API, not by Vite. Without
      // this every image in the dashboard is a broken box in development.
      '/media': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
