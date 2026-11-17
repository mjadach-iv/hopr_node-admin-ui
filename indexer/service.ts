import { getAddress, isAddress } from 'viem';
import { CT_NODES, DEFAULT_BLOKLI_URL, GNOSIS_RPC_URLS } from '../config';
import type { EarningsResponse, IndexerSettings, IndexerSettingsResponse, IndexerStatus } from '../src/indexer/types';
import { openDb } from './db';
import { aggregate, isBucketSize, isTimeZone } from './earnings';
import { createSync, type Log } from './sync';

export { createHttpListener } from './http';

export type IndexerRequest = {
  method: string;
  // below /indexer/api/, e.g. "settings" or "nodes/0xabc…"
  path: string;
  query: URLSearchParams;
  body: string;
  contentType: string | null;
};

export type IndexerResponse = { status: number; body: unknown };

export type Indexer = ReturnType<typeof createIndexer>;

export const DEFAULT_SETTINGS: IndexerSettings = {
  rpcUrls: GNOSIS_RPC_URLS,
  blokliUrl: DEFAULT_BLOKLI_URL,
  ctNodes: CT_NODES,
};

const MAX_RPCS = 20;
const MAX_CT_NODES = 1_000;
const MAX_NODES_PER_REQUEST = 1_000;

class BadRequest extends Error {}

const httpUrl = (value: unknown, what: string) => {
  if (typeof value !== 'string') throw new BadRequest(`${what} must be a string`);
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequest(`${what} is not a URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BadRequest(`${what} must be http(s): ${value}`);
  return value.trim();
};

const addressList = (value: unknown, what: string, max: number) => {
  if (!Array.isArray(value)) throw new BadRequest(`${what} must be a list of addresses`);
  if (value.length > max) throw new BadRequest(`At most ${max} ${what}`);
  return Array.from(
    new Set(
      value.map((address) => {
        if (typeof address !== 'string' || !isAddress(address)) throw new BadRequest(`Not an address: ${address}`);
        return getAddress(address);
      }),
    ),
  );
};

// a partial update, every given key validated
const parseSettings = (body: unknown): Partial<IndexerSettings> => {
  if (!body || typeof body !== 'object') throw new BadRequest('Expected a JSON object');
  const input = body as Record<string, unknown>;
  const settings: Partial<IndexerSettings> = {};
  if ('rpcUrls' in input) {
    if (!Array.isArray(input.rpcUrls) || input.rpcUrls.length === 0) {
      throw new BadRequest('rpcUrls must list at least one RPC');
    }
    if (input.rpcUrls.length > MAX_RPCS) throw new BadRequest(`At most ${MAX_RPCS} RPCs`);
    settings.rpcUrls = Array.from(new Set(input.rpcUrls.map((url) => httpUrl(url, 'An RPC url'))));
  }
  if ('blokliUrl' in input) settings.blokliUrl = httpUrl(input.blokliUrl, 'blokliUrl');
  if ('ctNodes' in input) settings.ctNodes = addressList(input.ctNodes, 'CT nodes', MAX_CT_NODES);
  return settings;
};

/**
 * The earnings indexer behind /indexer/api/: settings, the watched nodes and the redemptions of the
 * whole network in one SQLite file, and the sync that fills it. The same code runs in the desktop
 * app's main process and in the Docker image, `handle` serves the API in both.
 */
export const createIndexer = ({
  dbPath,
  persistent,
  seed = {},
  log = console,
}: {
  dbPath: string;
  // false when the file is lost with the container, the app then warns
  persistent: boolean;
  // overrides the built-in defaults for settings the database does not hold yet
  seed?: Partial<IndexerSettings>;
  log?: Log;
}) => {
  const defaults: IndexerSettings = { ...DEFAULT_SETTINGS, ...seed };
  const db = openDb(dbPath, defaults);
  if (db.replaced) log.warn(`[indexer] ${dbPath} was written by a newer version of the app, started a new one`);
  const sync = createSync({ db, log });
  let closed = false;

  const settingsResponse = (): IndexerSettingsResponse => ({
    ...db.getSettings(),
    edited: db.settingsEdited(),
    dbId: db.dbId(),
    // the built-in ones with any env overrides, what an unsaved setting follows
    defaults,
  });

  const status = (): IndexerStatus => {
    const meta = db.getIndexMeta();
    const { finalized, latest } = sync.state;
    // from the network's first block to its newest; finalized blocks lag a few minutes, so a synced
    // index stays just under 100%
    const progress =
      meta.cursor !== null && meta.startBlock !== null && latest !== null && latest >= meta.startBlock
        ? Math.min(1, Math.max(0, (meta.cursor - meta.startBlock + 1) / (latest - meta.startBlock + 1)))
        : null;
    return {
      phase: sync.state.phase,
      lastError: sync.state.lastError,
      persistent,
      dbId: db.dbId(),
      network: meta.network,
      channelsContract: meta.channelsContract,
      startBlock: meta.startBlock,
      startTs: meta.startBlock === null ? null : db.blockTime(meta.startBlock),
      cursor: meta.cursor,
      cursorTs: meta.cursor === null ? null : db.blockTime(meta.cursor),
      finalized,
      latest,
      progress,
      redemptions: db.redemptionCount(),
      nodes: db.getNodes(),
    };
  };

  const earnings = (query: URLSearchParams): EarningsResponse => {
    const nodes = addressList((query.get('nodes') ?? '').split(',').filter(Boolean), 'nodes', MAX_NODES_PER_REQUEST);
    const bucket = query.get('bucket') ?? '1d';
    if (!isBucketSize(bucket)) throw new BadRequest(`Unknown bucket ${bucket}`);
    const tz = query.get('tz') || 'UTC';
    if (!isTimeZone(tz)) throw new BadRequest(`Unknown time zone ${tz}`);
    const meta = db.getIndexMeta();
    const now = Math.floor(Date.now() / 1000);
    // nothing was redeemed before the contract's deployment
    const startTs = meta.startBlock === null ? null : db.blockTime(meta.startBlock);
    const from = Math.max(Number(query.get('from') ?? 0) || 0, startTs ?? 0);
    const to = Math.min(Number(query.get('to') ?? now) || now, now);
    const syncedTo = meta.cursor === null ? null : db.blockTime(meta.cursor);
    if (startTs === null || from >= to) {
      return { bucket, from, to, buckets: [], totals: {}, syncedTo };
    }
    const lowercase = nodes.map((node) => node.toLowerCase());
    const result = aggregate({
      rows: db.redemptionsTo(lowercase, from, to),
      spentRows: db.redemptionsFrom(lowercase, from, to),
      nodes,
      ctNodes: db.getSettings().ctNodes,
      bucket,
      from,
      to,
      tz,
    });
    if ('error' in result) throw new BadRequest(result.error);
    return { bucket, from, to, ...result, syncedTo };
  };

  const route = (request: IndexerRequest): IndexerResponse => {
    const { method, path } = request;
    const body = () => {
      // a cross-site page can only send text/plain or forms without a preflight, JSON keeps them out
      if (!request.contentType?.startsWith('application/json')) throw new BadRequest('Expected application/json');
      try {
        return JSON.parse(request.body) as unknown;
      } catch {
        throw new BadRequest('Invalid JSON');
      }
    };

    if (method === 'GET' && path === 'status') return { status: 200, body: status() };
    if (method === 'GET' && path === 'settings') return { status: 200, body: settingsResponse() };
    if (method === 'PUT' && path === 'settings') {
      db.saveSettings(parseSettings(body()));
      sync.wake();
      return { status: 200, body: settingsResponse() };
    }
    if (method === 'GET' && path === 'nodes') return { status: 200, body: db.getNodes() };
    if (method === 'POST' && path === 'nodes') {
      const input = body() as { addresses?: unknown } | null;
      db.addNodes(addressList(input?.addresses, 'nodes', MAX_NODES_PER_REQUEST));
      return { status: 200, body: db.getNodes() };
    }
    if (method === 'DELETE' && path.startsWith('nodes/')) {
      const [address] = addressList([decodeURIComponent(path.slice('nodes/'.length))], 'nodes', 1);
      db.removeNode(address);
      return { status: 200, body: db.getNodes() };
    }
    if (method === 'GET' && path === 'earnings') return { status: 200, body: earnings(request.query) };
    return { status: 404, body: { error: `No ${method} /indexer/api/${path}` } };
  };

  return {
    start: () => {
      sync.start();
      log.info(`[indexer] started with ${dbPath}${persistent ? '' : ' (not persistent)'}`);
    },
    // safe to call more than once, e.g. on quit and before an update installs
    stop: () => {
      if (closed) return;
      closed = true;
      sync.stop();
      db.close();
      log.info('[indexer] stopped');
    },
    handle: (request: IndexerRequest): IndexerResponse => {
      if (closed) return { status: 503, body: { error: 'The indexer is shutting down' } };
      try {
        return route(request);
      } catch (e) {
        if (e instanceof BadRequest) return { status: 400, body: { error: e.message } };
        const status = (e as { status?: number }).status ?? 500;
        if (status === 500) log.error('[indexer] request failed', e);
        return { status, body: { error: e instanceof Error ? e.message : String(e) } };
      }
    },
  };
};
