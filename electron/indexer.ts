import { app } from 'electron';
import log from 'electron-log/main';
import { createServer } from 'node:http';
import path from 'node:path';

// The earnings indexer (indexer/ in the repo) runs in the main process with its SQLite file in
// userData, next to the renderer's localStorage, which updates leave alone. The page reaches it at
// app://node-admin/indexer/api/ through protocol.ts, so no port is opened; only the Vite dev server
// of `pnpm electron:dev` proxies /indexer to DEV_PORT.

// what dist-indexer/service.cjs exports, it is bundled separately and outside this tsconfig
type IndexerRequest = {
  method: string;
  path: string;
  query: URLSearchParams;
  body: string;
  contentType: string | null;
};
type IndexerResponse = { status: number; body: unknown };
type Indexer = {
  start: () => void;
  stop: () => void;
  handle: (request: IndexerRequest) => IndexerResponse;
};
type IndexerModule = {
  createIndexer: (options: {
    dbPath: string;
    persistent: boolean;
    log?: Pick<Console, 'info' | 'warn' | 'error'>;
  }) => Indexer;
  createHttpListener: (indexer: Indexer) => Parameters<typeof createServer>[0];
};

const API_PREFIX = '/indexer/api/';
// vite.config.ts proxies /indexer here in development
const DEV_PORT = 4680;

let indexer: Indexer | null = null;

export const startIndexer = ({ dev }: { dev: boolean }) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createIndexer, createHttpListener } = require(path.join(
      __dirname,
      '..',
      'dist-indexer',
      'service.cjs',
    )) as IndexerModule;
    indexer = createIndexer({ dbPath: path.join(app.getPath('userData'), 'indexer.sqlite'), persistent: true, log });
    indexer.start();
    if (dev) {
      createServer(createHttpListener(indexer))
        .on('error', (error) => log.warn('[indexer] dev API not served', error))
        .listen(DEV_PORT, '127.0.0.1');
    }
  } catch (error) {
    // the app works without it, the earnings chart is hidden
    log.error('[indexer] could not start', error);
    indexer = null;
  }
};

// on quit and before an update installs; a second call does nothing
export const stopIndexer = () => {
  indexer?.stop();
  indexer = null;
};

export const isIndexerPath = (pathname: string) => pathname.startsWith(API_PREFIX);

export const handleIndexerRequest = async (request: Request, url: URL) => {
  if (!indexer) {
    return Response.json({ error: 'The earnings indexer is not running' }, { status: 503 });
  }
  const { status, body } = indexer.handle({
    method: request.method,
    path: url.pathname.slice(API_PREFIX.length),
    query: url.searchParams,
    body: request.method === 'GET' ? '' : await request.text(),
    contentType: request.headers.get('content-type'),
  });
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
};
