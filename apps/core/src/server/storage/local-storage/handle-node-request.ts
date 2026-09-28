import { type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type ReadableStream as NodeReadableStream } from 'node:stream/web';

export const handleNodeRequest = async (handle: (request: Request) => Promise<Response>, req: IncomingMessage, res: ServerResponse) => {
  const method = req.method ?? 'GET';
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      headers.append(name, item);
    }
  }

  const request = new Request(new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`), {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream<Uint8Array>),
    duplex: 'half',
  } as RequestInit);

  try {
    const response = await handle(request);

    res.writeHead(response.status, Object.fromEntries(response.headers));

    if (response.body) {
      await pipeline(Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>), res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error(err);

    if (res.headersSent) {
      res.destroy();
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal error');
    }
  }
};
