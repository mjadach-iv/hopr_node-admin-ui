import type { IncomingMessage, ServerResponse } from 'node:http';
import type { IndexerRequest, IndexerResponse } from './service';

export const API_PREFIX = '/indexer/api/';
const MAX_BODY = 1024 * 1024;

const readBody = (request: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });

/** Serves the indexer API over node:http, for the Docker image (behind nginx) and development. */
export const createHttpListener =
  (indexer: { handle: (request: IndexerRequest) => IndexerResponse }) =>
  async (request: IncomingMessage, response: ServerResponse) => {
    const send = ({ status, body }: IndexerResponse) => {
      response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    const url = new URL(request.url ?? '/', 'http://indexer');
    if (!url.pathname.startsWith(API_PREFIX)) {
      send({ status: 404, body: { error: 'Not found' } });
      return;
    }
    try {
      const body = request.method === 'GET' || request.method === 'HEAD' ? '' : await readBody(request);
      send(
        indexer.handle({
          method: request.method ?? 'GET',
          path: url.pathname.slice(API_PREFIX.length),
          query: url.searchParams,
          body,
          contentType: request.headers['content-type'] ?? null,
        }),
      );
    } catch (e) {
      send({ status: 400, body: { error: e instanceof Error ? e.message : String(e) } });
    }
  };
