import type {
  EarningsBucketSize,
  EarningsResponse,
  IndexerNode,
  IndexerSettings,
  IndexerSettingsResponse,
  IndexerStatus,
} from './types';

// same origin everywhere: nginx proxies it in Docker, the desktop app answers it in electron/protocol.ts
const BASE = '/indexer/api';

/** No indexer behind this build, e.g. the Vercel or FTP deploy, or it is down. */
export class IndexerUnavailableError extends Error {
  constructor(message = 'The earnings indexer is not available') {
    super(message);
    this.name = 'IndexerUnavailableError';
  }
}

const call = async <T>(path: string, init: RequestInit = {}, timeout = 15_000): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${BASE}/${path}`, {
      ...init,
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    throw new IndexerUnavailableError(e instanceof Error ? e.message : undefined);
  }
  // a host without an indexer answers with the app's index.html or a proxy error page
  if (!response.headers.get('content-type')?.includes('application/json')) throw new IndexerUnavailableError();
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    if (response.status === 502 || response.status === 503) throw new IndexerUnavailableError(body.error);
    throw new Error(body.error ?? `The indexer answered ${response.status}`);
  }
  return body;
};

export const getSettings = (timeout?: number) => call<IndexerSettingsResponse>('settings', {}, timeout);

export const saveSettings = (settings: Partial<IndexerSettings>) =>
  call<IndexerSettingsResponse>('settings', { method: 'PUT', body: JSON.stringify(settings) });

export const getStatus = () => call<IndexerStatus>('status');

export const addNodes = (addresses: string[]) =>
  call<IndexerNode[]>('nodes', { method: 'POST', body: JSON.stringify({ addresses }) });

export const removeNode = (address: string) =>
  call<IndexerNode[]>(`nodes/${encodeURIComponent(address)}`, { method: 'DELETE' });

export const getEarnings = ({
  nodes,
  bucket,
  from,
  to,
  tz,
}: {
  nodes: string[];
  bucket: EarningsBucketSize;
  from?: number;
  to?: number;
  tz?: string;
}) => {
  const query = new URLSearchParams({ nodes: nodes.join(','), bucket });
  if (from !== undefined) query.set('from', String(from));
  if (to !== undefined) query.set('to', String(to));
  if (tz) query.set('tz', tz);
  return call<EarningsResponse>(`earnings?${query}`, {}, 30_000);
};
