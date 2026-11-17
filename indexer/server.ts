import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import type { IndexerSettings } from '../src/indexer/types';
import { createHttpListener } from './http';
import { createIndexer } from './service';

/*
 * The indexer as a process of its own: in the Docker image next to nginx, which proxies
 * /indexer/ here, and for `pnpm indexer:dev`.
 *
 * INDEXER_DB          the SQLite file, /data/indexer.sqlite in Docker
 * INDEXER_HOST/PORT   where the API listens, 127.0.0.1:4680 by default
 * INDEXER_RPC_URLS    comma separated, INDEXER_BLOKLI_URL and INDEXER_CT_NODES (comma separated):
 *                     the first settings of a new database instead of the built-in defaults
 */

const list = (value: string | undefined) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const seed: Partial<IndexerSettings> = {};
const rpcUrls = list(process.env.INDEXER_RPC_URLS);
if (rpcUrls?.length) seed.rpcUrls = rpcUrls;
if (process.env.INDEXER_BLOKLI_URL) seed.blokliUrl = process.env.INDEXER_BLOKLI_URL.trim();
const ctNodes = list(process.env.INDEXER_CT_NODES);
if (ctNodes?.length) seed.ctNodes = ctNodes;

const dbPath = path.resolve(process.env.INDEXER_DB ?? 'indexer.sqlite');
const host = process.env.INDEXER_HOST ?? '127.0.0.1';
const port = Number(process.env.INDEXER_PORT ?? 4680);

/**
 * Whether the database directory is on a mount of its own (a Docker volume or bind mount). Without
 * one it lives in the container's writable layer and is gone when the container is recreated.
 * Outside Linux there is no /proc and nothing to warn about.
 */
const isPersistent = (dir: string) => {
  let mountinfo: string;
  try {
    mountinfo = fs.readFileSync('/proc/self/mountinfo', 'utf8');
  } catch {
    return true;
  }
  if (!fs.existsSync('/.dockerenv')) return true;
  // the 5th field is the mount point, with spaces escaped as \040
  const mountPoints = mountinfo
    .split('\n')
    .map((line) => line.split(' ')[4]?.replace(/\\040/g, ' '))
    .filter((mountPoint): mountPoint is string => !!mountPoint && mountPoint !== '/');
  return mountPoints.some((mountPoint) => dir === mountPoint || dir.startsWith(`${mountPoint}/`));
};

const dbDir = path.dirname(dbPath);
fs.mkdirSync(dbDir, { recursive: true });
const persistent = isPersistent(dbDir);
if (!persistent) {
  console.warn(
    `[indexer] ${dbDir} is not a volume: settings and indexed history are lost when the container is recreated. ` +
      `Mount one, e.g. -v hopr-admin-data:${dbDir}`,
  );
}

const indexer = createIndexer({ dbPath, persistent, seed });
const server = createServer(createHttpListener(indexer));
server.listen(port, host, () => {
  console.info(`[indexer] API on http://${host}:${port}/indexer/api/`);
  indexer.start();
});

const shutdown = () => {
  server.close();
  indexer.stop();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
