import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import svgrPlugin from 'vite-plugin-svgr';

// the hoprd image registry has no CORS, so the app reads it through this path (also in nginx.conf and vercel.json)
const hoprdTagsProxy = {
  '/hoprd-tags': {
    target: 'https://europe-west3-docker.pkg.dev',
    changeOrigin: true,
    rewrite: () => '/v2/hoprassociation/docker-images/hoprd/tags/list',
  },
};

// the earnings indexer of `pnpm indexer:dev` or `pnpm electron:dev` (indexer/server.ts, electron/indexer.ts)
const indexerProxy = {
  '/indexer': { target: 'http://127.0.0.1:4680' },
};

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    server: { proxy: { ...hoprdTagsProxy, ...indexerProxy } },
    preview: { proxy: { ...hoprdTagsProxy, ...indexerProxy } },
    plugins: [
      // import svg
      svgrPlugin(),
      // linter
      checker({
        overlay: false,
        typescript: true,
      }),
      // emotion setup with react
      react({
        jsxImportSource: '@emotion/react',
        babel: { plugins: ['@emotion/babel-plugin'] },
      }),
    ],
    optimizeDeps: {
      include: ['@emotion/react', '@emotion/styled', '@mui/material/Tooltip'],
    },
    build: {
      outDir: 'build',
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return;
          }
          warn(warning);
        },
      },
    },
  };
});
