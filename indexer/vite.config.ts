import { defineConfig } from 'vite';

// The indexer for Node: service.cjs is required by the desktop app's main process, server.cjs runs
// on its own in the Docker image, make-snapshot.cjs is `pnpm indexer:snapshot`. viem and the rest
// are bundled, node: builtins stay external.
export default defineConfig({
  // public/ belongs to the app; the committed snapshot of the index goes next to the bundles
  publicDir: 'indexer/snapshot',
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
        'make-snapshot': 'indexer/make-snapshot.ts',
      },
      output: {
        format: 'cjs',
        entryFileNames: '[name].cjs',
        chunkFileNames: '[name]-[hash].cjs',
      },
    },
  },
});
