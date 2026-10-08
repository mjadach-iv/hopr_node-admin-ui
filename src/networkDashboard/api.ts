import { getAddress, isAddress } from 'viem';
import type { NodeStatsType, NodesStatsType } from './types';

export const NETWORK_DASHBOARD_URL = 'https://network.hoprnet.org';

// dashboard environment ids by hoprd network name; loadNetworks has no CORS so this stays static
const DASHBOARD_ENV_BY_NETWORK: Record<string, number> = {
  dufour: 3,
  'piz-palu-prod': 5,
};

export const dashboardEnvId = (networkName: string | null | undefined): number | null =>
  networkName ? DASHBOARD_ENV_BY_NETWORK[networkName] ?? null : null;

// getSomeNodes caps the body at 10kb, which is roughly 200 addresses
const CHUNK_SIZE = 150;

export class networkDashboardApiError extends Error {
  code: string;

  constructor({ code, message }: { code: string; message: string }) {
    super(message);
    this.name = 'networkDashboardApiError';
    this.code = code;
  }
}

type GetSomeNodesRow = {
  address: string;
  availability24h?: number | null;
  availability7d?: number | null;
  availability30d?: number | null;
  latency?: number | null;
  firstseen?: number | null;
  lastseen?: number | null;
  version?: string | null;
  lastThroughput?: number | null;
  maxLastThroughput?: number | null;
  lastMeasuredAt?: number | null;
  throughput24h?: number | null;
  maxThroughput24h?: number | null;
};

type GetSomeNodesResponse = {
  nodes: GetSomeNodesRow[];
  config: { lastRun: number | null; now: number | null };
};

const postSomeNodes = async (envId: number, nodes: string[], timeout: number): Promise<GetSomeNodesResponse> => {
  let response: Response;
  try {
    response = await fetch(`${NETWORK_DASHBOARD_URL}/api/getSomeNodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env: envId, nodes }),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new networkDashboardApiError({
        code: 'TIMEOUT',
        message: `Network dashboard did not answer within ${timeout}ms`,
      });
    }
    throw new networkDashboardApiError({
      code: 'FETCH_ERROR',
      message: e instanceof Error ? e.message : 'Could not reach the network dashboard',
    });
  }

  if (!response.ok) {
    throw new networkDashboardApiError({
      code: 'HTTP_ERROR',
      message: `Network dashboard responded with ${response.status} ${response.statusText}`,
    });
  }

  const json = (await response.json()) as GetSomeNodesResponse | null;
  if (!json || !Array.isArray(json.nodes)) {
    throw new networkDashboardApiError({
      code: 'EMPTY_RESPONSE',
      message: 'Network dashboard returned no data',
    });
  }
  return json;
};

const parseRow = (row: GetSomeNodesRow): NodeStatsType => ({
  address: getAddress(row.address),
  availability24h: row.availability24h ?? null,
  availability7d: row.availability7d ?? null,
  availability30d: row.availability30d ?? null,
  latency: row.latency ?? null,
  firstSeen: row.firstseen ?? null,
  lastSeen: row.lastseen ?? null,
  version: row.version ?? null,
  lastThroughput: row.lastThroughput ?? null,
  maxLastThroughput: row.maxLastThroughput ?? null,
  lastMeasuredAt: row.lastMeasuredAt ?? null,
  throughput24h: row.throughput24h ?? null,
  maxThroughput24h: row.maxThroughput24h ?? null,
});

/**
 * Stats for the given nodes. The dashboard matches addresses case-sensitively
 * against checksummed ones, so everything is checksummed before it is sent.
 */
export const getNodesStats = async ({
  envId,
  addresses,
  timeout = 30_000,
}: {
  envId: number;
  addresses: string[];
  timeout?: number;
}): Promise<NodesStatsType> => {
  const unique = Array.from(
    new Set(addresses.filter((address) => isAddress(address)).map((address) => getAddress(address))),
  );
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + CHUNK_SIZE));
  }

  const responses = await Promise.all(chunks.map((chunk) => postSomeNodes(envId, chunk, timeout)));

  const byAddress: Record<string, NodeStatsType> = {};
  let lastRun: number | null = null;
  for (const response of responses) {
    for (const row of response.nodes) {
      if (!row.address || !isAddress(row.address)) continue;
      const parsed = parseRow(row);
      byAddress[parsed.address] = parsed;
    }
    if (response.config?.lastRun) lastRun = response.config.lastRun;
  }

  return { byAddress, lastRun };
};
