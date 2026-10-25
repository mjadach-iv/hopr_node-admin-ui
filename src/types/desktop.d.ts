import type { DesktopApi } from '../../electron/shared';

declare global {
  interface Window {
    /** Set by the Electron preload (electron/preload.ts), undefined in the browser. */
    desktop?: DesktopApi;
  }
}
