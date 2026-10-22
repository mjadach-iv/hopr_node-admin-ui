import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';
import path from 'node:path';
import { openExternal } from './links';
import { buildMenu } from './menu';
import { handleAppScheme, isAppUrl, registerAppScheme, START_URL } from './protocol';
import { setupUpdater, startUpdateChecks } from './updater';

// same as --bg in src/index.css, so the window does not flash white while it loads
const BACKGROUND = '#04052a';

registerAppScheme();

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: BACKGROUND,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  // target="_blank" links and window.open (explorer, Safe{Wallet}, the node's Swagger UI) go to the browser
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  void window.loadURL(START_URL);
  return window;
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app
    .whenReady()
    .then(() => {
      log.info(`${app.name} ${app.getVersion()} starting`);
      handleAppScheme();
      setupUpdater();
      buildMenu();
      createWindow();
      startUpdateChecks();
    })
    .catch((error) => log.error('startup failed', error));
}
