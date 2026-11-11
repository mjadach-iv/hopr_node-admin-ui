import { app } from 'electron';
import log from 'electron-log/main';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { contentSecurityPolicy } from './protocol';

// Safe{Wallet} loads custom Safe Apps over http(s) only, the app:// origin is not reachable. So the
// packaged app serves build/ on loopback like the docker image's nginx does (nginx.conf), and the
// allowance page opens as a Safe App from there.

const HOST = '127.0.0.1';
// fixed, so Safe{Wallet} sees the same app url on every start; the docker image uses 4677
const PORT = 4678;
// the pages' paths in the web build, SAFE_APP_PATHS in src/utils/safeApp.ts; below each, its
// manifest.json and icon come from <path>-static
const SAFE_APP_PATHS = ['/safe-app', '/safe-app-add-node', '/safe-app-remove-node'];
// only Safe{Wallet} may frame the page, its SDK talks to no other parent anyway
const CONTENT_SECURITY_POLICY = contentSecurityPolicy('https://app.safe.global');
// Safe{Wallet} reads <appUrl>/manifest.json and the icon cross-origin
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET',
  'access-control-allow-headers': 'X-Requested-With, content-type, Authorization',
};
// content-hashed build output (e.g. index-B1a2c3D4.js) never changes
const HASHED_ASSET = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.(js|css|woff2?|ttf)$/;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

let origin: string | null = null;

/** Where the Safe App is served, e.g. http://127.0.0.1:4678; null when the server is not running. */
export const safeAppOrigin = () => origin;

const isFile = (file: string) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

// null when the path leaves the directory
const resolveIn = (dir: string, pathname: string) => {
  const file = path.join(dir, pathname);
  const relative = path.relative(dir, file);
  return relative.startsWith('..') || path.isAbsolute(relative) ? null : file;
};

const send = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  file: string | null,
  headers: Record<string, string> = {},
) => {
  if (!file || !isFile(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  // build/ is packed into app.asar, fs reads from it transparently
  fs.createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
};

const handle = (root: string, req: http.IncomingMessage, res: http.ServerResponse) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    send(req, res, null);
    return;
  }

  const safeAppPath = SAFE_APP_PATHS.find((appPath) => pathname.startsWith(`${appPath}/`));
  if (safeAppPath) {
    const file = resolveIn(path.join(root, `${safeAppPath.slice(1)}-static`), pathname.slice(safeAppPath.length));
    send(req, res, file, { ...CORS_HEADERS, 'cache-control': 'no-cache' });
    return;
  }

  const indexFile = path.join(root, 'index.html');
  const file = resolveIn(root, pathname);
  if (file && file !== indexFile && isFile(file)) {
    send(req, res, file, {
      'cache-control': HASHED_ASSET.test(pathname) ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    return;
  }
  // a missing chunk or asset must not be answered with index.html, the rest is a client side route
  if (!file || (file !== indexFile && (path.extname(pathname) || pathname.startsWith('/assets/')))) {
    send(req, res, null);
    return;
  }
  send(req, res, indexFile, { 'content-security-policy': CONTENT_SECURITY_POLICY, 'cache-control': 'no-cache' });
};

const listen = (root: string, port: number) =>
  new Promise<number>((resolve, reject) => {
    const server = http.createServer((req, res) => handle(root, req, res));
    server.once('error', reject);
    server.listen(port, HOST, () => {
      server.off('error', reject);
      resolve((server.address() as AddressInfo).port);
    });
  });

/** Must run once the app is ready, before the window loads: the preload reads the origin. */
export const startSafeAppServer = async () => {
  const root = path.join(app.getAppPath(), 'build');
  let port: number;
  try {
    port = await listen(root, PORT);
  } catch (error) {
    // another app holds the port, a random one still works but Safe{Wallet} sees a new app url
    log.warn(`port ${PORT} is taken, serving the Safe App on a random port`, error);
    try {
      port = await listen(root, 0);
    } catch (error) {
      log.error('could not serve the Safe App, the allowance link opens the Safe instead', error);
      return;
    }
  }
  origin = `http://${HOST}:${port}`;
  log.info(`Safe Apps served at ${origin}`);
};
