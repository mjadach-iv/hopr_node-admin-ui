import { defineConfig } from 'vite';

// The indexer for Node: service.cjs is required by the desktop app's main process, server.cjs runs
// on its own in the Docker image. viem and the rest are bundled, node: builtins stay external.
export default defineConfig({
  // public/ belongs to the app
  publicDir: false,
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: true,
    outDir: 'dist-indexer',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: {
      input: {
        service: 'indexer/service.ts',
        server: 'indexer/server.ts',
      },
      output: {
        format: 'cjs',
        entryFileNames: '[name].cjs',
        chunkFileNames: '[name]-[hash].cjs',
      },
    },
  },
});
