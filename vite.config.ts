import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      {
        name: 'api-server-middleware',
        async configureServer(server) {
          const { createServer } = await import('./server/index');
          const apiApp = createServer();
          server.middlewares.use((req, res, next) => {
            if (req.url?.startsWith('/api')) {
              apiApp(req as any, res as any, (err: any) => {
                if (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: String(err) }));
                } else if (!res.writableEnded) {
                  res.statusCode = 404;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Not found', path: req.url }));
                }
              });
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
