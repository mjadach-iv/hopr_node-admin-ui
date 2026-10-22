import { app, dialog, Menu, type MenuItemConstructorOptions } from 'electron';
import { openExternal, RELEASES_URL, REPOSITORY_URL } from './links';
import { checkForUpdatesFromMenu } from './updater';

const isMac = process.platform === 'darwin';

const checkForUpdates: MenuItemConstructorOptions = {
  label: 'Check for Updates…',
  click: () => void checkForUpdatesFromMenu(),
};

const showAbout = () =>
  dialog.showMessageBox({
    type: 'info',
    message: app.name,
    detail: `Version ${app.getVersion()}\nElectron ${process.versions.electron}, Chromium ${
      process.versions.chrome
    }\n\n${REPOSITORY_URL}`,
  });

export const buildMenu = () => {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              checkForUpdates,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : [{ role: 'fileMenu' } satisfies MenuItemConstructorOptions]),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        ...(isMac ? [] : [checkForUpdates, { type: 'separator' } satisfies MenuItemConstructorOptions]),
        { label: 'Releases', click: () => openExternal(RELEASES_URL) },
        { label: 'Report an Issue', click: () => openExternal(`${REPOSITORY_URL}/issues`) },
        ...(isMac ? [] : [{ label: `About ${app.name}`, click: () => void showAbout() }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};
