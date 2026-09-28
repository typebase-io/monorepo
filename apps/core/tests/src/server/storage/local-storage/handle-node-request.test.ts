import { mkdtempSync, rmSync } from 'node:fs';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStorage } from '#server/storage/create-storage.ts';
import { defineStorage } from '#server/storage/define-storage.ts';
import { createLocalStorage } from '#server/storage/local-storage/create-local-storage.ts';
import { handleNodeRequest } from '#server/storage/local-storage/handle-node-request.ts';

describe('handleNodeRequest', () => {
  let server: Server;
  let servers: Server[];
  let root: string;

  const listen = async (handle: (request: Request) => Promise<Response>) => {
    server = createServer((req, res) => void handleNodeRequest(handle, req, res));
    servers.push(server);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  beforeEach(() => {
    servers = [];
    root = mkdtempSync(path.join(tmpdir(), 'typebase-node-request-test-'));
  });

  afterEach(async () => {
    await Promise.all(servers.map((each) => new Promise((resolve) => each.close(resolve))));
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('hands the handler the method, URL, headers and body of the node request', async () => {
    let received: { method: string; url: string; header: string | null; body: string } | undefined;

    const origin = await listen(async (request) => {
      received = { method: request.method, url: request.url, header: request.headers.get('x-test'), body: await request.text() };

      return new Response(null, { status: 204 });
    });

    await fetch(`${origin}/storage/documents/a.txt?signature=abc`, { method: 'PUT', body: 'payload', headers: { 'X-Test': 'yes' } });

    expect(received).toEqual({ method: 'PUT', url: `${origin}/storage/documents/a.txt?signature=abc`, header: 'yes', body: 'payload' });
  });

  it('writes the status, headers and streamed body of the response back', async () => {
    const origin = await listen(() => Promise.resolve(new Response('streamed', { status: 201, headers: { 'X-Answer': 'yes' } })));

    const response = await fetch(`${origin}/anything`);

    expect(response.status).toBe(201);
    expect(response.headers.get('x-answer')).toBe('yes');
    expect(await response.text()).toBe('streamed');
  });

  it('ends a response that has no body', async () => {
    const origin = await listen(() => Promise.resolve(new Response(null, { status: 204 })));

    const response = await fetch(`${origin}/anything`, { method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('serves downloads and accepts uploads for local storage', async () => {
    const local = createLocalStorage({ root, url: 'http://127.0.0.1:8080/storage' });
    const storage = createStorage(defineStorage({ provider: 'vercel', buckets: { documents: { access: 'private' } } }), { local });

    const origin = await listen(local.handle);
    const onServer = (url: string) => url.replace('http://127.0.0.1:8080', origin);

    const upload = await storage.bucket('documents').signedUploadUrl('n.txt', { expiresIn: 60, contentType: 'text/plain' });
    const uploaded = await fetch(onServer(upload.url), {
      method: 'PUT',
      body: 'through node',
      headers: upload.method === 'PUT' ? upload.headers : undefined,
    });

    expect(uploaded.status).toBe(200);

    const downloaded = await fetch(onServer(await storage.bucket('documents').signedUrl('n.txt')));

    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-type')).toBe('text/plain');
    expect(await downloaded.text()).toBe('through node');
  });

  it('answers 500 and keeps serving when the handler fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls = 0;

    const origin = await listen(() => {
      calls += 1;

      return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve(new Response('ok'));
    });

    const failed = await fetch(`${origin}/storage/a`);

    expect(failed.status).toBe(500);
    expect(await failed.text()).toBe('Internal error');
    expect(await (await fetch(`${origin}/storage/a`)).text()).toBe('ok');
    expect(logged).toHaveBeenCalled();
  });

  it('drops the connection when the response body fails after the headers went out', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const origin = await listen(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start: (controller) => {
              controller.enqueue(new TextEncoder().encode('partial'));
              controller.error(new Error('disk gone'));
            },
          })
        )
      )
    );

    await expect(fetch(`${origin}/anything`).then((response) => response.text())).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
  });

  it('reads a request with no method, URL or host as a GET of / on localhost, keeping repeated headers and skipping missing ones', async () => {
    let received: { method: string; url: string; cookies: string | null; missing: boolean } | undefined;
    const written: { status?: number; ended: boolean } = { ended: false };

    const req = Object.assign(Readable.from([]), {
      method: undefined,
      url: undefined,
      headers: { 'set-cookie': ['a=1', 'b=2'], 'x-missing': undefined },
    }) as unknown as IncomingMessage;

    const res = {
      writeHead: (status: number) => {
        written.status = status;
      },
      end: () => {
        written.ended = true;
      },
    } as unknown as ServerResponse;

    await handleNodeRequest(
      (request) => {
        received = {
          method: request.method,
          url: request.url,
          cookies: request.headers.get('set-cookie'),
          missing: request.headers.has('x-missing'),
        };

        return Promise.resolve(new Response(null, { status: 204 }));
      },
      req,
      res
    );

    expect(received).toEqual({ method: 'GET', url: 'http://localhost/', cookies: 'a=1, b=2', missing: false });
    expect(written).toEqual({ status: 204, ended: true });
  });
});
