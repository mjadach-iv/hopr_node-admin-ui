import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import { openExternal, RELEASES_URL } from './links';
import { isAppUrl } from './protocol';
import type { UpdateState } from './shared';

// Updates come from the GitHub releases of the repository (publish in electron-builder.yml). A
// prerelease version such as 5.0.0-alpha.15 also takes prereleases, a stable one only stable releases.

const FIRST_CHECK_DELAY = 10_000;
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

let state: UpdateState = { status: 'idle' };

const setState = (next: UpdateState) => {
  state = next;
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send('updates:state', state);
};

// CI sets desktop.macSigned in the packaged package.json when it signs with a Developer ID
const isMacSigned = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
    // the CLI may pass the extraMetadata value as a string
    return pkg.desktop?.macSigned === true || pkg.desktop?.macSigned === 'true';
  } catch {
    return false;
  }
};

// Squirrel.Mac refuses to install into an unsigned app, so there the update is only announced
const manual = process.platform === 'darwin' && !isMacSigned();

const updateVersion = () => ('version' in state ? state.version : null);

const openReleasePage = () => {
  const version = updateVersion();
  openExternal(version ? `${RELEASES_URL}/tag/${encodeURIComponent(version)}` : `${RELEASES_URL}/latest`);
};

const install = () => {
  if (state.status !== 'ready') return;
  // after the IPC reply, quitAndInstall closes every window
  setImmediate(() => autoUpdater.quitAndInstall());
};

// a check while one runs or a download is done would only repeat work
const canCheck = () => app.isPackaged && !['checking', 'downloading', 'ready'].includes(state.status);

const check = async () => {
  if (!canCheck()) return;
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    // reported through the error event
  }
};

const trusted = (event: IpcMainInvokeEvent) => !!event.senderFrame && isAppUrl(event.senderFrame.url);

export const setupUpdater = () => {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = !manual;
  autoUpdater.autoInstallOnAppQuit = !manual;

  autoUpdater.on('checking-for-update', () => setState({ status: 'checking' }));
  autoUpdater.on('update-not-available', () => setState({ status: 'idle' }));
  autoUpdater.on('update-available', ({ version }) =>
    setState(manual ? { status: 'available', version, manual: true } : { status: 'downloading', version, percent: 0 }),
  );
  autoUpdater.on('download-progress', ({ percent }) => {
    if (state.status === 'downloading') setState({ ...state, percent: Math.floor(percent) });
  });
  autoUpdater.on('update-downloaded', ({ version }) => setState({ status: 'ready', version }));
  autoUpdater.on('error', (error) => {
    log.error('update failed', error);
    // electron-updater appends request headers and a stack to the message, the first line says what failed
    const [summary] = (error?.message ?? String(error)).split('\n');
    setState({ status: 'error', message: summary });
  });

  ipcMain.on('desktop:info', (event) => {
    event.returnValue = { version: app.getVersion(), platform: process.platform };
  });
  ipcMain.handle('updates:state', (event) => (trusted(event) ? state : { status: 'idle' }));
  ipcMain.handle('updates:check', (event) => (trusted(event) ? check() : undefined));
  ipcMain.handle('updates:install', (event) => (trusted(event) ? install() : undefined));
  ipcMain.handle('updates:openReleasePage', (event) => (trusted(event) ? openReleasePage() : undefined));
};

/** On start (after a short delay, so the window loads first) and every 6 hours. */
export const startUpdateChecks = () => {
  if (!app.isPackaged) return;
  setTimeout(check, FIRST_CHECK_DELAY);
  setInterval(check, CHECK_INTERVAL);
};

const message = (options: Electron.MessageBoxOptions) => {
  const window = BrowserWindow.getFocusedWindow();
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
};

/** "Check for Updates…" in the menu: like the background check, but always answers. */
export const checkForUpdatesFromMenu = async () => {
  if (!app.isPackaged) {
    await message({ type: 'info', message: 'Updates are only checked in the installed app.' });
    return;
  }

  if (canCheck()) {
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      // the state is 'error' now
    }
  }

  const current = app.getVersion();
  switch (state.status) {
    case 'ready': {
      const { response } = await message({
        type: 'info',
        message: `Version ${state.version} is ready to install`,
        detail: `You are running ${current}. The app restarts to update.`,
        buttons: ['Restart to update', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) install();
      return;
    }
    case 'downloading':
      await message({
        type: 'info',
        message: `Version ${state.version} is downloading`,
        detail: 'You will be asked to restart once it is ready.',
      });
      return;
    case 'available': {
      const { response } = await message({
        type: 'info',
        message: `Version ${state.version} is available`,
        detail: `You are running ${current}. This build cannot update itself, download the new version from GitHub.`,
        buttons: ['Download from GitHub', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) openReleasePage();
      return;
    }
    case 'error':
      await message({ type: 'warning', message: 'Could not check for updates', detail: state.message });
      return;
    default:
      await message({
        type: 'info',
        message: "You're up to date",
        detail: `HOPR Node Admin ${current} is the newest version.`,
      });
  }
};
