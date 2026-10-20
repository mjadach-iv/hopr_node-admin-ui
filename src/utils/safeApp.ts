import { parseEther } from 'viem';

// its manifest.json and icon are served from public/safe-app-static, see nginx.conf
export const SAFE_APP_PATH = '/safe-app';

// below this the node soon can no longer fund channels from the safe
export const LOW_ALLOWANCE = parseEther('10000');

/** Opens the allowance page as a custom Safe App for the Safe, on Gnosis Chain. */
export const safeAppLink = (safeAddress: string) =>
  `https://app.safe.global/apps/open?safe=gno:${safeAddress}&appUrl=${encodeURIComponent(
    window.location.origin + SAFE_APP_PATH,
  )}`;
