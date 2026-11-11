import { parseEther } from 'viem';
import { desktop } from './desktop';

// each page's manifest.json and icon are served from public/<path>-static, see nginx.conf and
// electron/safeAppServer.ts; not below /safe-app/, which only serves those files
export const SAFE_APP_PATHS = {
  allowance: '/safe-app',
  addNode: '/safe-app-add-node',
  removeNode: '/safe-app-remove-node',
} as const;

export type SafeAppName = keyof typeof SAFE_APP_PATHS;

// below this the node soon can no longer fund channels from the safe
export const LOW_ALLOWANCE = parseEther('10000');

// Safe{Wallet} loads custom Safe Apps over http(s) only. The desktop app's app:// origin is not
// reachable, so it serves the pages on localhost; null when nothing serves them
const safeAppOrigin =
  desktop?.safeAppOrigin ?? (/^https?:$/.test(window.location.protocol) ? window.location.origin : null);

/** Opens one of the pages as a custom Safe App for the Safe, on Gnosis Chain (the Safe's home page when nothing serves it). */
export const safeAppLink = (safeAddress: string, app: SafeAppName) =>
  safeAppOrigin
    ? `https://app.safe.global/apps/open?safe=gno:${safeAddress}&appUrl=${encodeURIComponent(
        safeAppOrigin + SAFE_APP_PATHS[app],
      )}`
    : `https://app.safe.global/home?safe=gno:${safeAddress}`;
