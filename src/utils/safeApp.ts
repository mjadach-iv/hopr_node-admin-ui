import { parseEther } from 'viem';

// its manifest.json and icon are served from public/safe-app-static, see nginx.conf
export const SAFE_APP_PATH = '/safe-app';

// below this the node soon can no longer fund channels from the safe
export const LOW_ALLOWANCE = parseEther('10000');

// Safe{Wallet} loads custom Safe Apps over http(s) only, the desktop app's app:// origin is not reachable
const canHostSafeApp = /^https?:$/.test(window.location.protocol);

/** Opens the allowance page as a custom Safe App for the Safe, on Gnosis Chain (the Safe's home page in the desktop app). */
export const safeAppLink = (safeAddress: string) =>
  canHostSafeApp
    ? `https://app.safe.global/apps/open?safe=gno:${safeAddress}&appUrl=${encodeURIComponent(
        window.location.origin + SAFE_APP_PATH,
      )}`
    : `https://app.safe.global/home?safe=gno:${safeAddress}`;
