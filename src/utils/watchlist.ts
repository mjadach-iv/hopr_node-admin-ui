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

// the first address of every line, so a header row, extra columns or a plain list all import
export function parseWatchlistFile(contents: string): string[] {
  const addresses = contents.split(/\r?\n/).flatMap((line) => line.match(/0x[0-9a-fA-F]{40}/)?.[0] ?? []);
  return Array.from(new Set(addresses.filter((address) => isAddress(address)).map((address) => getAddress(address))));
}
