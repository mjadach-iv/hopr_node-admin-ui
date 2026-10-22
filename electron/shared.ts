// Types shared by the main process, the preload and the renderer (src/types/desktop.d.ts).
// Import this file with `import type` only: the sandboxed preload cannot require local files.

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  // macOS without a Developer ID signature cannot install updates, so the user downloads it from GitHub
  | { status: 'available'; version: string; manual: true }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string };

export type DesktopInfo = {
  version: string;
  platform: string;
};

export type DesktopApi = DesktopInfo & {
  updates: {
    getState(): Promise<UpdateState>;
    check(): Promise<void>;
    install(): Promise<void>;
    openReleasePage(): Promise<void>;
    /** Calls back on every change, returns the unsubscribe function. */
    onState(callback: (state: UpdateState) => void): () => void;
  };
};
