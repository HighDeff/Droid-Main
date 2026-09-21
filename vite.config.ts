import react from '@vitejs/plugin-react-swc';
import crypto from 'node:crypto';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(async () => {
  const browserSessionToken = crypto.randomBytes(32).toString('base64url');
  const { createServer } = await import('./server/index');
  const apiApp = createServer({ browserSessionToken });
  const mountApplication = (server: { middlewares: { use: (handler: any) => void } }) => {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (/^\/api(?:\/|[?]|$)/.test(req.url ?? '')) {
        apiApp(req, res, next);
      } else {
        next();
      }
    });
  };

  return {
    plugins: [
      react(),
      {
        name: 'api-server-middleware',
        configureServer(server) {
          mountApplication(server);
        },
        configurePreviewServer(server) {
          mountApplication(server);
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