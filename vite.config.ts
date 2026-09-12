import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig } from 'vite';
import { createServer } from './server/index';

export default defineConfig(() => {
  const apiApp = createServer();

  return {
    plugins: [
      react(),
      {
        name: 'api-server-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api')) {
              apiApp(req as any, res as any, next);
            } else {
              next();
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './client'),
        '@shared': path.resolve(__dirname, './shared'),
      },
    },
    server: {
      port: 3000,
      strictPort: true, // Prevents Vite from silently shifting to port 3001/3002 on collision
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // File watching is deactivated when DISABLE_HMR is true to save CPU and avoid intermediate rebuilds.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
