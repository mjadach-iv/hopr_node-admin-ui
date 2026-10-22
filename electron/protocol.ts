import { app, net, protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The packaged app serves the Vite build from app://node-admin/, a secure standard origin. The web
// build runs unchanged (BrowserRouter, absolute /assets/... paths), the clipboard API is available
// and localStorage keeps the same origin across updates.
export const APP_SCHEME = 'app';
export const APP_HOST = 'node-admin';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

// `pnpm electron:dev` loads the Vite dev server instead
export const DEV_URL = process.env.ELECTRON_RENDERER_URL;
export const START_URL = DEV_URL ?? `${APP_ORIGIN}/`;

// URL.origin is "null" for custom schemes, so compare scheme and host
const originOf = (url: string) => {
  const { protocol, host } = new URL(url);
  return `${protocol}//${host}`;
};
const APP_ORIGINS = new Set([APP_ORIGIN, ...(DEV_URL ? [originOf(DEV_URL)] : [])]);

/** True for pages of the app itself, false for external sites and anything unparsable. */
export const isAppUrl = (url: string) => {
  try {
    return APP_ORIGINS.has(originOf(url));
  } catch {
    return false;
  }
};

// the hoprd image registry has no CORS, the web build reads it through the same path (vite.config.ts, nginx.conf)
const HOPRD_TAGS_PATH = '/hoprd-tags';
const HOPRD_TAGS_URL = 'https://europe-west3-docker.pkg.dev/v2/hoprassociation/docker-images/hoprd/tags/list';

// node APIs, blokli, RPCs and the network dashboard are user configurable, so connect-src stays open
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self' * data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Must run before the app is ready. */
export const registerAppScheme = () => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true },
    },
  ]);
};

const notFound = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });

const isFile = (file: string) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

const proxyHoprdTags = async () => {
  try {
    const upstream = await net.fetch(HOPRD_TAGS_URL, { signal: AbortSignal.timeout(15_000) });
    // a fresh response, so upstream encoding and caching headers are not passed on
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return new Response('Registry unreachable', { status: 502, headers: { 'content-type': 'text/plain' } });
  }
};

const serveIndex = async (indexFile: string) => {
  const response = await net.fetch(pathToFileURL(indexFile).toString());
  return new Response(response.body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': CONTENT_SECURITY_POLICY,
    },
  });
};

/** Must run once the app is ready. */
export const handleAppScheme = () => {
  // build/ is packed into app.asar, fs and net.fetch read from it transparently
  const root = path.join(app.getAppPath(), 'build');
  const indexFile = path.join(root, 'index.html');

  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return notFound();

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return notFound();
    }

    if (pathname === HOPRD_TAGS_PATH) return proxyHoprdTags();

    const file = path.join(root, pathname);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return notFound();

    if (file === indexFile) return serveIndex(indexFile);
    if (isFile(file)) return net.fetch(pathToFileURL(file).toString());

    // a missing chunk or asset must not be answered with index.html, the rest is a client side route
    if (path.extname(pathname) || pathname.startsWith('/assets/')) return notFound();
    return serveIndex(indexFile);
  });
};
