import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createPublicClient, fallback, http } from 'viem';
import { GNOSIS_RPC_URLS } from '../config';
import type { IndexerSettings, IndexerStatus } from '../src/indexer/types';
import { createIndexer } from './service';
import { readMeta, SNAPSHOT_DATA, writeSnapshot } from './snapshot';

/*
 * `pnpm indexer:snapshot`: syncs the index on this machine up to the finalized block and writes it
 * to indexer/snapshot/ (snapshot.ts), to be committed. It starts from the snapshot of the last run,
 * which the build copied next to this file, and keeps its database in .indexer/snapshot.sqlite.
 *
 * INDEXER_RPC_URLS    comma separated, and INDEXER_BLOKLI_URL, instead of the built-in defaults
 * SNAPSHOT_UNTIL      a time on this machine's clock, e.g. 2026-11-18T23:00, to stop at its block
 *                     instead of the finalized one; a snapshot or database past it starts over
 */

const PROGRESS_MS = 10_000;

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'indexer', 'snapshot');
const dbPath = path.join(root, '.indexer', 'snapshot.sqlite');

const seed: Partial<IndexerSettings> = {};
const rpcUrls = process.env.INDEXER_RPC_URLS?.split(',')
  .map((url) => url.trim())
  .filter(Boolean);
if (rpcUrls?.length) seed.rpcUrls = rpcUrls;
if (process.env.INDEXER_BLOKLI_URL) seed.blokliUrl = process.env.INDEXER_BLOKLI_URL.trim();

// the last block at or before `ts`, unix seconds
const blockAt = async (rpcUrls: string[], ts: number) => {
  const client = createPublicClient({ transport: fallback(rpcUrls.map((url) => http(url, { timeout: 15_000 }))) });
  const timeOf = async (block: number) => Number((await client.getBlock({ blockNumber: BigInt(block) })).timestamp);
  let high = Number(await client.getBlockNumber());
  if ((await timeOf(high)) <= ts) return high;
  let low = 0;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((await timeOf(middle)) <= ts) low = middle;
    else high = middle - 1;
  }
  return low;
};

const dbCursor = (file: string) => {
  if (!fs.existsSync(file)) return null;
  const db = new DatabaseSync(file);
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'cursor'").get() as { value: string } | undefined;
    return row ? Number(row.value) : null;
  } catch {
    return null;
  } finally {
    db.close();
  }
};

const synced = async (indexer: ReturnType<typeof createIndexer>, untilBlock: number | undefined) => {
  for (let lastProgress = 0; ; ) {
    const status = indexer.handle({
      method: 'GET',
      path: 'status',
      query: new URLSearchParams(),
      body: '',
      contentType: null,
    }).body as IndexerStatus;
    const { cursor, finalized } = status;
    const target = finalized === null ? null : Math.min(finalized, untilBlock ?? finalized);
    if (status.phase === 'idle' && cursor !== null && target !== null && cursor >= target) return;
    if (Date.now() - lastProgress >= PROGRESS_MS) {
      lastProgress = Date.now();
      const percent = status.progress === null ? '' : ` (${(status.progress * 100).toFixed(1)}%)`;
      console.info(`[snapshot] at block ${cursor ?? '-'} of ${target ?? '-'}${percent}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
};

const main = async () => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  let untilBlock: number | undefined;
  // the shipped snapshot, unless it is past the block
  let snapshotDir: string | null | undefined;
  if (process.env.SNAPSHOT_UNTIL) {
    const until = new Date(process.env.SNAPSHOT_UNTIL.trim());
    if (Number.isNaN(until.getTime())) throw new Error(`SNAPSHOT_UNTIL ${process.env.SNAPSHOT_UNTIL} is no time`);
    untilBlock = await blockAt(rpcUrls?.length ? rpcUrls : GNOSIS_RPC_URLS, Math.floor(until.getTime() / 1000));
    console.info(`[snapshot] up to block ${untilBlock}, the last one at or before ${until.toISOString()}`);
    // an index cannot go back, one past the block is synced again from the chain
    const cursor = dbCursor(dbPath);
    if (cursor !== null && cursor > untilBlock) {
      console.info(`[snapshot] ${path.relative(root, dbPath)} is at block ${cursor}, starting over`);
      [dbPath, `${dbPath}-wal`, `${dbPath}-shm`].forEach((file) => fs.rmSync(file, { force: true }));
    }
    const shipped = readMeta(__dirname);
    if (shipped && shipped.cursor > untilBlock) snapshotDir = null;
  }
  const indexer = createIndexer({ dbPath, persistent: true, seed, snapshotDir, untilBlock });
  indexer.start();
  await synced(indexer, untilBlock);
  indexer.stop();

  console.info('[snapshot] compressing, about a minute');
  const meta = writeSnapshot({ dbPath, dir });
  const size = fs.statSync(path.join(dir, SNAPSHOT_DATA)).size;
  console.info(
    `[snapshot] ${meta.network} up to block ${meta.cursor} (${new Date((meta.cursorTs ?? 0) * 1000).toISOString()}), ` +
      `${meta.redemptions} redemptions, ${(size / 1024 / 1024).toFixed(1)} MB in ${path.relative(root, dir)}/`,
  );
  // an RPC request still out would hold the process for its timeout
  process.exit(0);
};

main().catch((e) => {
  console.error('[snapshot] failed', e);
  process.exit(1);
});
