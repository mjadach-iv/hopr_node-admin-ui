import { app, BrowserWindow, dialog, ipcMain, net, type IpcMainInvokeEvent } from 'electron';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import { openExternal, RELEASES_URL } from './links';
import { isAppUrl } from './protocol';
import type { UpdateState } from './shared';

// Updates come from the GitHub releases of the repository. A prerelease version such as
// 5.0.0-alpha.15 also takes prereleases, a stable one only stable releases.
// electron-updater's GitHub provider finds the newest version in releases.atom, which also lists tags
// without a release, so the release is picked from the releases API and its download folder is
// handed to the generic provider, which reads latest*.yml from there.

const RELEASES_API_URL = 'https://api.github.com/repos/mjadach-iv/hopr_node-admin-ui/releases?per_page=100';
const UPDATE_FILE = /^latest.*\.yml$/;
const FIRST_CHECK_DELAY = 10_000;
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT = 10_000;

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

const fail = (error: unknown) => {
  log.error('update failed', error);
  // electron-updater appends request headers and a stack to the message, the first line says what failed
  const [summary] = (error instanceof Error ? error.message : String(error)).split('\n');
  setState({ status: 'error', message: summary });
};

type Release = { tag_name: string; draft: boolean; prerelease: boolean; assets: { name: string }[] };

// The API lists releases newest first. Releases without update files (made before the desktop app) are skipped.
const findLatestRelease = async (): Promise<string | null> => {
  const response = await net.fetch(RELEASES_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!response.ok) throw new Error(`Could not load the GitHub releases: HTTP ${response.status}`);
  const releases = (await response.json()) as Release[];
  const release = releases.find(
    (release) =>
      !release.draft &&
      (autoUpdater.allowPrerelease || !release.prerelease) &&
      release.assets.some((asset) => UPDATE_FILE.test(asset.name)),
  );
  return release?.tag_name ?? null;
};

const check = async () => {
  if (!canCheck()) return;
  setState({ status: 'checking' });
  let tag: string | null;
  try {
    tag = await findLatestRelease();
  } catch (error) {
    fail(error);
    return;
  }
  if (!tag) {
    setState({ status: 'idle' });
    return;
  }
  autoUpdater.setFeedURL({ provider: 'generic', url: `${RELEASES_URL}/download/${encodeURIComponent(tag)}` });
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
  autoUpdater.on('error', fail);

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

  await check();

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
