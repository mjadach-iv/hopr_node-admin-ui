import { isAddress, getAddress } from 'viem';
import { loadStateFromLocalStorage, saveStateToLocalStorage } from './localStorage';

const WATCHLIST_KEY = 'app/watchlist';

export function saveWatchlist(watchlist: string[]) {
  saveStateToLocalStorage(WATCHLIST_KEY, watchlist);
}

// hand-edited storage must not break the page
export function loadWatchlist(): string[] {
  const stored = loadStateFromLocalStorage(WATCHLIST_KEY);
  if (!Array.isArray(stored)) return [];
  return Array.from(
    new Set(
      stored
        .filter((address): address is string => typeof address === 'string' && isAddress(address))
        .map((address) => getAddress(address)),
    ),
  );
}
