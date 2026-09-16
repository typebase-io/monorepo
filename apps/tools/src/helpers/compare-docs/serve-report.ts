import { readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.log': 'text/plain; charset=utf-8',
};

export const serveReport = async (directory: string, port: number): Promise<string> => {
  const root = await realpath(path.resolve(directory));

  const server = createServer((request, response) => {
    void (async () => {
      try {
        const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
        const file = await realpath(path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)));

        if (!file.startsWith(root + path.sep)) {
          response.writeHead(403).end();

          return;
        }

        response.writeHead(200, {
          'Content-Type': contentTypes[path.extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(await readFile(file));
      } catch {
        response.writeHead(404).end('Not found');
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('The report server did not bind to a local port.');
  }

  return `http://127.0.0.1:${address.port}`;
};
