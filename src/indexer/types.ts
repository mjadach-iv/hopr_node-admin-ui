// The earnings indexer's HTTP API at /indexer/api/, shared by the indexer (indexer/) and the app

/** Kept in the indexer's database, the one place the app reads them from. */
export type IndexerSettings = {
  // Gnosis RPCs in fallback order
  rpcUrls: string[];
  blokliUrl: string;
  // node addresses whose tickets count as cover traffic, checksummed
  ctNodes: string[];
};

export type IndexerSettingsResponse = IndexerSettings & {
  // false until settings were saved once, so a browser holding a backup may restore them
  edited: boolean;
  // new with every database file
  dbId: string;
  defaults: IndexerSettings;
};

export type IndexerPhase = 'starting' | 'syncing' | 'idle';

export type IndexerNode = {
  address: string;
  active: boolean;
  // unix seconds
  addedAt: number;
};

export type IndexerStatus = {
  phase: IndexerPhase;
  // of the last failed sync attempt, retried
  lastError: string | null;
  // false when the database is lost with the container (Docker without a volume at /data)
  persistent: boolean;
  dbId: string;
  network: string | null;
  channelsContract: string | null;
  startBlock: number | null;
  // the time of startBlock, unix seconds: where "All" begins
  startTs: number | null;
  // the last block indexed and its time in unix seconds
  cursor: number | null;
  cursorTs: number | null;
  // the chain's finalized block, where the sync stops
  finalized: number | null;
  // the chain's newest block
  latest: number | null;
  // 0 to 1 from startBlock to latest
  progress: number | null;
  redemptions: number;
  nodes: IndexerNode[];
};

export type EarningsBucketSize = '15m' | '1h' | '1d' | '1w';

// wei as decimal strings: earned from CT and from traffic, and spent, the tickets the nodes paid
export type EarningsSplit = { ct: string; traffic: string; spent: string };

export type EarningsBucket = EarningsSplit & {
  // bucket start, unix seconds
  t: number;
};

export type EarningsResponse = {
  bucket: EarningsBucketSize;
  from: number;
  to: number;
  buckets: EarningsBucket[];
  // per requested node over the whole range, keyed as requested
  totals: Record<string, EarningsSplit>;
  // the data covers blocks up to this time, unix seconds
  syncedTo: number | null;
};
