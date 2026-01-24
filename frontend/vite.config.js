import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // This mimics Nginx: requests to /api are sent to the python backend
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // Optional: if your backend expects /api/users but your python route is just /users
        // rewrite: (path) => path.replace(/^\/api/, ''), 
      },
      // Also proxy the WebSocket for logs
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      }
    }
  }
})