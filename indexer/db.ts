import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { IndexerNode, IndexerSettings } from '../src/indexer/types';

/*
 * The file carries two versions, so it never has to be deleted by hand:
 * - PRAGMA user_version: the layout of the user data (meta, settings, nodes). A newer app runs the
 *   numbered MIGRATIONS below on it, which never drop data. A file from a newer app than this one
 *   (after a downgrade) is deleted and started over: the settings come back from a browser's copy or
 *   the defaults, the watched nodes from the browsers, the index from the chain
 * - meta index_version: the index (channels, redemptions, block_anchors), rebuilt from the chain in a
 *   minute or two whenever it differs from INDEX_VERSION, either way, or blokli points at another
 *   channels contract; the user data stays
 */

const MIGRATIONS = [
  `CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE nodes (address TEXT PRIMARY KEY, active INTEGER NOT NULL, added_at INTEGER NOT NULL);`,
];

// bump when the index tables or the decoding change, it re-syncs the index and keeps the user data
export const INDEX_VERSION = 1;

export const INDEX_TABLES = ['channels', 'redemptions', 'block_anchors'];
// meta keys that belong to the index
const INDEX_META = ['index_version', 'channels_contract', 'network', 'start_block', 'cursor'];

const INDEX_SCHEMA = `
  CREATE TABLE channels (
    channel_id TEXT PRIMARY KEY,
    source TEXT,
    destination TEXT,
    epoch INTEGER NOT NULL,
    -- wei, 96 bits do not fit an INTEGER
    balance TEXT NOT NULL
  ) WITHOUT ROWID;
  CREATE TABLE redemptions (
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    block INTEGER NOT NULL,
    -- unix seconds, interpolated between block_anchors
    ts INTEGER NOT NULL,
    channel_id TEXT NOT NULL,
    -- lowercase, null for a channel opened before the scan started
    source TEXT,
    destination TEXT,
    amount TEXT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
  ) WITHOUT ROWID;
  CREATE INDEX redemptions_destination_ts ON redemptions (destination, ts);
  -- what a node spent: the tickets it paid
  CREATE INDEX redemptions_source_ts ON redemptions (source, ts);
  CREATE TABLE block_anchors (block INTEGER PRIMARY KEY, ts INTEGER NOT NULL);
`;

export type StoredChannel = {
  source: string | null;
  destination: string | null;
  epoch: bigint;
  balance: bigint;
};

export type Redemption = {
  txHash: string;
  logIndex: number;
  block: number;
  ts: number;
  channelId: string;
  source: string | null;
  destination: string | null;
  amount: bigint;
};

export type IndexMeta = {
  channelsContract: string | null;
  network: string | null;
  startBlock: number | null;
  cursor: number | null;
};

export type IndexerDb = ReturnType<typeof openDb>;

const connect = (path: string) => {
  const db = new DatabaseSync(path);
  // WAL and one transaction per scanned window: a crash or kill loses at most the window in progress
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
  return db;
};

const userVersionOf = (db: DatabaseSync) =>
  Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);

/**
 * Opens or creates the database and brings it to this app's versions, see above. `replaced` tells
 * that a file from a newer app was deleted for a new one.
 */
export const openDb = (path: string, seed: IndexerSettings) => {
  let db = connect(path);
  let userVersion = userVersionOf(db);
  const replaced = userVersion > MIGRATIONS.length;
  if (replaced) {
    db.close();
    [path, `${path}-wal`, `${path}-shm`].forEach((file) => fs.rmSync(file, { force: true }));
    db = connect(path);
    userVersion = 0;
  }

  const transaction = <T>(run: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = run();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };

  for (let version = userVersion; version < MIGRATIONS.length; version++) {
    transaction(() => {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }

  const getMeta = (key: string): string | null => {
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  };
  const setMeta = (key: string, value: string | number) =>
    db
      .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
      .run(key, String(value));
  const numberMeta = (key: string) => {
    const value = getMeta(key);
    return value === null ? null : Number(value);
  };

  // inside a transaction
  const recreateIndex = () => {
    INDEX_TABLES.forEach((table) => db.exec(`DROP TABLE IF EXISTS ${table}`));
    db.exec(INDEX_SCHEMA);
    INDEX_META.forEach((key) => db.prepare('DELETE FROM meta WHERE key = ?').run(key));
    setMeta('index_version', INDEX_VERSION);
  };
  const resetIndex = () => transaction(recreateIndex);

  if (!getMeta('db_id')) setMeta('db_id', randomUUID());
  if (numberMeta('index_version') !== INDEX_VERSION) resetIndex();
  // added after INDEX_VERSION 1 was out, an index needs no re-sync
  db.exec('CREATE INDEX IF NOT EXISTS redemptions_source_ts ON redemptions (source, ts)');
  // Only saved settings are stored, the rest follow the env or the built-in defaults of the running
  // version, so a new default (e.g. more CT nodes) reaches every database that kept it. The first
  // builds stored the defaults of a new file too; nothing in a never edited file was chosen.
  if (getMeta('settings_edited') !== 'true') db.exec('DELETE FROM settings');

  const getSettings = (): IndexerSettings => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const stored = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
    return { ...seed, ...stored };
  };

  const upsertChannel = db.prepare(
    `INSERT INTO channels (channel_id, source, destination, epoch, balance) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (channel_id) DO UPDATE SET source = excluded.source, destination = excluded.destination,
       epoch = excluded.epoch, balance = excluded.balance`,
  );
  const insertRedemption = db.prepare(
    `INSERT INTO redemptions (tx_hash, log_index, block, ts, channel_id, source, destination, amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
  );
  const insertAnchor = db.prepare('INSERT INTO block_anchors (block, ts) VALUES (?, ?) ON CONFLICT DO NOTHING');

  return {
    replaced,
    close: () => db.close(),

    dbId: () => getMeta('db_id') ?? '',
    settingsEdited: () => getMeta('settings_edited') === 'true',
    getSettings,
    saveSettings: (settings: Partial<IndexerSettings>) =>
      transaction(() => {
        Object.entries(settings).forEach(([key, value]) => {
          db.prepare(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
          ).run(key, JSON.stringify(value));
        });
        setMeta('settings_edited', 'true');
      }),

    getNodes: (): IndexerNode[] =>
      (
        db.prepare('SELECT address, active, added_at FROM nodes ORDER BY added_at, address').all() as {
          address: string;
          active: number;
          added_at: number;
        }[]
      ).map((row) => ({ address: row.address, active: !!row.active, addedAt: row.added_at })),
    // watching a node again keeps when it was first added
    addNodes: (addresses: string[]) =>
      transaction(() => {
        const now = Math.floor(Date.now() / 1000);
        addresses.forEach((address) =>
          db
            .prepare(
              `INSERT INTO nodes (address, active, added_at) VALUES (?, 1, ?)
               ON CONFLICT (address) DO UPDATE SET active = 1`,
            )
            .run(address, now),
        );
      }),
    removeNode: (address: string) => db.prepare('UPDATE nodes SET active = 0 WHERE address = ?').run(address),

    getIndexMeta: (): IndexMeta => ({
      channelsContract: getMeta('channels_contract'),
      network: getMeta('network'),
      startBlock: numberMeta('start_block'),
      cursor: numberMeta('cursor'),
    }),
    // a new channels contract starts the index over
    startIndex: ({
      channelsContract,
      network,
      startBlock,
    }: {
      channelsContract: string;
      network: string;
      startBlock: number;
    }) => {
      resetIndex();
      transaction(() => {
        setMeta('channels_contract', channelsContract);
        setMeta('network', network);
        setMeta('start_block', startBlock);
        setMeta('cursor', startBlock - 1);
      });
    },
    // the index tables of a snapshot file (snapshot.ts) instead of this one's, the user data stays
    restoreIndex: (
      file: string,
      {
        channelsContract,
        network,
        startBlock,
        cursor,
      }: { channelsContract: string; network: string; startBlock: number; cursor: number },
    ) => {
      db.prepare('ATTACH DATABASE ? AS snapshot').run(file);
      try {
        transaction(() => {
          recreateIndex();
          INDEX_TABLES.forEach((table) => db.exec(`INSERT INTO ${table} SELECT * FROM snapshot.${table}`));
          setMeta('channels_contract', channelsContract);
          setMeta('network', network);
          setMeta('start_block', startBlock);
          setMeta('cursor', cursor);
        });
      } finally {
        db.exec('DETACH DATABASE snapshot');
      }
    },
    setNetwork: (network: string) => setMeta('network', network),
    // where the stored channels contract came from, so it is kept while that blokli is down
    resolvedBlokliUrl: () => getMeta('resolved_blokli_url'),
    setResolvedBlokliUrl: (url: string) => setMeta('resolved_blokli_url', url),

    loadChannels: () => {
      const rows = db.prepare('SELECT channel_id, source, destination, epoch, balance FROM channels').all() as {
        channel_id: string;
        source: string | null;
        destination: string | null;
        epoch: number;
        balance: string;
      }[];
      return new Map<string, StoredChannel>(
        rows.map((row) => [
          row.channel_id,
          { source: row.source, destination: row.destination, epoch: BigInt(row.epoch), balance: BigInt(row.balance) },
        ]),
      );
    },

    // everything one scanned window found, with the cursor, in one transaction
    commitWindow: ({
      to,
      channels,
      redemptions,
      anchors,
    }: {
      to: number;
      channels: Map<string, StoredChannel>;
      redemptions: Redemption[];
      anchors: Map<number, number>;
    }) =>
      transaction(() => {
        channels.forEach((channel, channelId) =>
          upsertChannel.run(
            channelId,
            channel.source,
            channel.destination,
            Number(channel.epoch),
            channel.balance.toString(),
          ),
        );
        redemptions.forEach((r) =>
          insertRedemption.run(
            r.txHash,
            r.logIndex,
            r.block,
            r.ts,
            r.channelId,
            r.source,
            r.destination,
            r.amount.toString(),
          ),
        );
        anchors.forEach((ts, block) => insertAnchor.run(block, ts));
        setMeta('cursor', to);
      }),

    // the time of the nearest anchor at or before the block, exact when the block is an anchor
    blockTime: (block: number): number | null => {
      const row = db
        .prepare('SELECT block, ts FROM block_anchors WHERE block <= ? ORDER BY block DESC LIMIT 1')
        .get(block) as { block: number; ts: number } | undefined;
      return row ? row.ts : null;
    },
    addAnchors: (anchors: Map<number, number>) =>
      transaction(() => anchors.forEach((ts, block) => insertAnchor.run(block, ts))),

    redemptionCount: () => Number((db.prepare('SELECT COUNT(*) AS n FROM redemptions').get() as { n: number }).n),

    // received by the given lowercase destinations within [from, to)
    redemptionsTo: (destinations: string[], from: number, to: number) => {
      if (destinations.length === 0) return [];
      const params: SQLInputValue[] = [...destinations, from, to];
      return db
        .prepare(
          `SELECT destination, source, ts, amount FROM redemptions
           WHERE destination IN (${destinations.map(() => '?').join(', ')}) AND ts >= ? AND ts < ?`,
        )
        .all(...params) as { destination: string; source: string | null; ts: number; amount: string }[];
    },

    // paid by the given lowercase sources within [from, to)
    redemptionsFrom: (sources: string[], from: number, to: number) => {
      if (sources.length === 0) return [];
      const params: SQLInputValue[] = [...sources, from, to];
      return db
        .prepare(
          `SELECT source, ts, amount FROM redemptions
           WHERE source IN (${sources.map(() => '?').join(', ')}) AND ts >= ? AND ts < ?`,
        )
        .all(...params) as { source: string; ts: number; amount: string }[];
    },
  };
};
