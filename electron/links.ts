import { shell } from 'electron';
import log from 'electron-log/main';

export const REPOSITORY_URL = 'https://github.com/mjadach-iv/hopr_node-admin-ui';
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** Opens web links in the default browser, ignores anything else (file:, custom schemes). */
export const openExternal = (url: string) => {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    log.warn('not opening an invalid link', url);
    return;
  }
  if (!EXTERNAL_PROTOCOLS.has(protocol)) {
    log.warn('not opening a link of this protocol in the browser', url);
    return;
  }
  log.info('opening in the default browser', url);
  shell.openExternal(url).catch((error) => log.error('could not open the default browser', url, error));
};
