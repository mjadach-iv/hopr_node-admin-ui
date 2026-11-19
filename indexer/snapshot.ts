import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import zlib from 'node:zlib';
import { INDEX_TABLES, INDEX_VERSION, type IndexerDb } from './db';
import type { Log } from './sync';

/*
 * A snapshot of the index (channels, redemptions, block_anchors) that ships with the app, so a new
 * database starts at the block it was taken at instead of the contract's deployment. It is made on
 * a dev machine with `pnpm indexer:snapshot` (make-snapshot.ts) into indexer/snapshot/, committed,
 * and copied by the build next to service.cjs and server.cjs:
 * - SNAPSHOT_META, what it holds, read on every start
 * - SNAPSHOT_DATA, the tables without their indexes, brotli compressed, only unpacked to restore it
 */

export const SNAPSHOT_META = 'index-snapshot.json';
export const SNAPSHOT_DATA = 'index-snapshot.sqlite.br';

export type SnapshotMeta = {
  indexVersion: number;
  network: string;
  channelsContract: string;
  startBlock: number;
  cursor: number;
  // unix seconds of the cursor and when it was made, for whoever reads the file
  cursorTs: number | null;
  createdAt: number;
  redemptions: number;
};

export const readMeta = (dir: string): SnapshotMeta | null => {
  let meta: Partial<SnapshotMeta>;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, SNAPSHOT_META), 'utf8')) as Partial<SnapshotMeta>;
  } catch {
    return null;
  }
  const valid =
    typeof meta.indexVersion === 'number' &&
    typeof meta.network === 'string' &&
    typeof meta.channelsContract === 'string' &&
    Number.isInteger(meta.startBlock) &&
    Number.isInteger(meta.cursor);
  return valid ? (meta as SnapshotMeta) : null;
};

/**
 * Puts the snapshot in `dir` in place of the database's index when it has the same INDEX_VERSION,
 * the same channels contract or none yet, and goes further. Whatever fails, the sync goes on from
 * the chain. The sync still asks blokli for the contract, another one starts the index over.
 */
export const restoreSnapshot = ({
  db,
  dir,
  tmpPath,
  log,
}: {
  db: IndexerDb;
  dir: string;
  // where the snapshot is unpacked for the moment it is read
  tmpPath: string;
  log: Log;
}) => {
  const snapshot = readMeta(dir);
  if (!snapshot || snapshot.indexVersion !== INDEX_VERSION) return false;
  const current = db.getIndexMeta();
  if (current.channelsContract !== null && current.channelsContract !== snapshot.channelsContract) return false;
  if (current.cursor !== null && current.cursor >= snapshot.cursor) return false;
  try {
    fs.writeFileSync(tmpPath, zlib.brotliDecompressSync(fs.readFileSync(path.join(dir, SNAPSHOT_DATA))));
    db.restoreIndex(tmpPath, snapshot);
    log.info(
      `[indexer] restored the snapshot of ${snapshot.network} up to block ${snapshot.cursor}` +
        (current.cursor === null ? '' : `, the index was at ${current.cursor}`),
    );
    return true;
  } catch (e) {
    log.warn('[indexer] could not restore the snapshot, indexing from the chain', e);
    return false;
  } finally {
    [tmpPath, `${tmpPath}-journal`].forEach((file) => fs.rmSync(file, { force: true }));
  }
};

/** Writes the index of the closed database at `dbPath` as a snapshot into `dir`. */
export const writeSnapshot = ({ dbPath, dir }: { dbPath: string; dir: string }): SnapshotMeta => {
  const tmpPath = `${dbPath}.export`;
  fs.rmSync(tmpPath, { force: true });

  const source = new DatabaseSync(dbPath);
  const value = (key: string) =>
    (source.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null;
  const cursor = Number(value('cursor'));
  const meta: SnapshotMeta = {
    indexVersion: Number(value('index_version')),
    network: value('network') ?? '',
    channelsContract: value('channels_contract') ?? '',
    startBlock: Number(value('start_block')),
    cursor,
    cursorTs:
      (source.prepare('SELECT ts FROM block_anchors WHERE block = ?').get(cursor) as { ts: number } | undefined)?.ts ??
      null,
    createdAt: Math.floor(Date.now() / 1000),
    redemptions: Number((source.prepare('SELECT COUNT(*) AS n FROM redemptions').get() as { n: number }).n),
  };
  if (meta.indexVersion !== INDEX_VERSION || !meta.channelsContract || !meta.cursor) {
    source.close();
    throw new Error(`${dbPath} holds no index of INDEX_VERSION ${INDEX_VERSION}`);
  }
  source.prepare('VACUUM INTO ?').run(tmpPath);
  source.close();

  // only the index tables, their indexes are built again on restore and would add a third
  const copy = new DatabaseSync(tmpPath);
  copy.exec('PRAGMA journal_mode = DELETE');
  const objects = copy
    .prepare("SELECT type, name FROM sqlite_schema WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%'")
    .all() as { type: 'table' | 'index'; name: string }[];
  objects.filter(({ type }) => type === 'index').forEach(({ name }) => copy.exec(`DROP INDEX "${name}"`));
  objects
    .filter(({ type, name }) => type === 'table' && !INDEX_TABLES.includes(name))
    .forEach(({ name }) => copy.exec(`DROP TABLE "${name}"`));
  copy.exec('VACUUM');
  copy.close();

  const raw = fs.readFileSync(tmpPath);
  fs.rmSync(tmpPath, { force: true });
  const compressed = zlib.brotliCompressSync(raw, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
      [zlib.constants.BROTLI_PARAM_LGWIN]: zlib.constants.BROTLI_MAX_WINDOW_BITS,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, SNAPSHOT_DATA), compressed);
  fs.writeFileSync(path.join(dir, SNAPSHOT_META), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
};
