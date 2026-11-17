import { loadStateFromLocalStorage, saveStateToLocalStorage } from '../utils/localStorage';
import type { IndexerSettings, IndexerSettingsResponse } from './types';

/*
 * The indexer's database holds the settings, this browser keeps a copy of the last ones it saw. The
 * copy is never used as settings itself; it puts them back into a database that was never edited,
 * e.g. a Docker container recreated without a volume. The settings of versions before the indexer
 * (app/configuration/rpc and /blokli) are taken over the same way, then removed.
 */

const BACKUP_KEY = 'app/settingsBackup';
const LEGACY_RPC_KEY = 'app/configuration/rpc';
const LEGACY_BLOKLI_KEY = 'app/configuration/blokli';

type Backup = { dbId: string; settings: IndexerSettings };

const sameList = (a: string[], b: string[]) => a.join(',') === b.join(',');

const differs = (a: Partial<IndexerSettings>, b: IndexerSettings) =>
  (a.rpcUrls !== undefined && !sameList(a.rpcUrls, b.rpcUrls)) ||
  (a.blokliUrl !== undefined && a.blokliUrl !== b.blokliUrl) ||
  (a.ctNodes !== undefined && !sameList(a.ctNodes, b.ctNodes));

const loadLegacy = (): Partial<IndexerSettings> => {
  const rpc = loadStateFromLocalStorage(LEGACY_RPC_KEY) as { urls?: unknown } | null;
  const blokli = loadStateFromLocalStorage(LEGACY_BLOKLI_KEY) as { url?: unknown } | null;
  const legacy: Partial<IndexerSettings> = {};
  if (Array.isArray(rpc?.urls) && rpc.urls.length && rpc.urls.every((url) => typeof url === 'string')) {
    legacy.rpcUrls = rpc.urls;
  }
  if (typeof blokli?.url === 'string' && blokli.url) legacy.blokliUrl = blokli.url;
  return legacy;
};

/** Settings worth putting back into `current`, a database never edited; null when there are none. */
export const settingsToRestore = (current: IndexerSettingsResponse): Partial<IndexerSettings> | null => {
  if (current.edited) return null;
  const backup = loadStateFromLocalStorage(BACKUP_KEY) as Backup | null;
  const candidate = backup?.settings ?? loadLegacy();
  return differs(candidate, current) ? candidate : null;
};

export const saveBackup = (current: IndexerSettingsResponse) => {
  const { rpcUrls, blokliUrl, ctNodes, dbId } = current;
  saveStateToLocalStorage(BACKUP_KEY, { dbId, settings: { rpcUrls, blokliUrl, ctNodes } } satisfies Backup);
  // taken over by now, or the database already had settings of its own
  try {
    localStorage.removeItem(LEGACY_RPC_KEY);
    localStorage.removeItem(LEGACY_BLOKLI_KEY);
  } catch (e) {
    console.warn('Could not remove the old settings from localStorage', e);
  }
};
