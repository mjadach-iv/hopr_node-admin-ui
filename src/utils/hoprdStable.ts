import { findNewerVersion, parseVersion } from './version';

// same origin proxy (nginx, vite, vercel) of the hoprd image registry, which has no CORS
const HOPRD_TAGS_URL = '/hoprd-tags';
const CACHE_TIME = 6 * 60 * 60 * 1000;
const RETRY_TIME = 5 * 60 * 1000;
const FETCH_TIMEOUT = 15_000;

let cached: { version: string | null; expires: number } | null = null;
let pending: Promise<string | null> | null = null;

// the X.Y.Z tag of the image tagged 'stable', as the network dashboard reads it
const fetchStable = async (): Promise<string | null> => {
  const response = await fetch(HOPRD_TAGS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!response.ok) return null;
  const json = (await response.json()) as { manifest?: Record<string, { tag?: string[] }> };
  const stableImage = Object.values(json.manifest ?? {}).find((image) => image.tag?.includes('stable'));
  return stableImage?.tag?.find((tag) => parseVersion(tag)?.prerelease.length === 0) ?? null;
};

export const getHoprdStableVersion = async (): Promise<string | null> => {
  if (cached && Date.now() < cached.expires) return cached.version;
  pending ??= fetchStable()
    .catch(() => null)
    .then((version) => {
      cached = { version, expires: Date.now() + (version ? CACHE_TIME : RETRY_TIME) };
      pending = null;
      return version;
    });
  return pending;
};

/** The stable hoprd version when it is newer than the node's, otherwise null. */
export const hoprdUpdateFor = (nodeVersion: string | null | undefined, stable: string | null): string | null => {
  if (!nodeVersion || !stable) return null;
  // the api returns the version quoted, dev builds add +build metadata
  const current = nodeVersion.replaceAll('"', '').split('+')[0];
  return findNewerVersion(current, [stable]);
};
