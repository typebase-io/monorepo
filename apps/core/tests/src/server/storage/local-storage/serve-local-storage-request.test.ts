import { Files, FilesError } from 'files-sdk';
import { memory } from 'files-sdk/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type LocalStorageBucketEntry, serveLocalStorageRequest } from '#server/storage/local-storage/serve-local-storage-request.ts';
import { signLocalStorageUrl } from '#server/storage/local-storage/sign-local-storage-url.ts';

describe('serveLocalStorageRequest', () => {
  const BASE_URL = 'http://localhost/storage';

  let buckets: Map<string, LocalStorageBucketEntry>;

  const filesOf = (bucket: string) => {
    const entry = buckets.get(bucket);

    if (!entry) {
      throw new Error(`No bucket ${bucket}`);
    }

    return entry.files;
  };

  beforeEach(async () => {
    buckets = new Map([
      ['avatars', { files: new Files({ adapter: memory() }), access: 'public' as const }],
      ['documents', { files: new Files({ adapter: memory() }), access: 'private' as const }],
    ]);

    await filesOf('avatars').upload('me.txt', 'avatar', { contentType: 'text/plain' });
    await filesOf('documents').upload('d.txt', 'document', { contentType: 'text/plain' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const serve = (url: string, init?: RequestInit) =>
    serveLocalStorageRequest({ request: new Request(url, init), buckets, basePath: '/storage', secret: 'secret' });

  const sign = (bucket: string, key: string, method: 'GET' | 'PUT', params?: Record<string, string | undefined>) =>
    signLocalStorageUrl({ secret: 'secret', baseUrl: BASE_URL, method, bucket, key, expiresIn: 60, params });

  const put = (url: string, body: string, contentType?: string) =>
    serve(url, { method: 'PUT', body, headers: contentType === undefined ? {} : { 'Content-Type': contentType } });

  it('answers a preflight with the methods and headers a browser may use', async () => {
    const response = await serve(`${BASE_URL}/avatars/me.txt`, { method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(Object.fromEntries(response.headers)).toEqual({
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, PUT',
      'access-control-allow-headers': 'Content-Type',
      'access-control-max-age': '600',
    });
  });

  describe('downloads', () => {
    it('serves a public file without a signature, with its type, size and nosniff', async () => {
      const response = await serve(`${BASE_URL}/avatars/me.txt`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('avatar');
      expect(Object.fromEntries(response.headers)).toEqual({
        'access-control-allow-origin': '*',
        'content-type': 'text/plain',
        'content-length': '6',
        'x-content-type-options': 'nosniff',
      });
    });

    it('answers a HEAD request with the headers and no body', async () => {
      const response = await serve(`${BASE_URL}/avatars/me.txt`, { method: 'HEAD' });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-length')).toBe('6');
      expect(response.body).toBeNull();
    });

    it('serves a private file only at a signed URL', async () => {
      expect((await serve(`${BASE_URL}/documents/d.txt`)).status).toBe(403);
      expect(await (await serve(`${BASE_URL}/documents/d.txt`)).text()).toBe('Missing, invalid or expired signature');
      expect(await (await serve(sign('documents', 'd.txt', 'GET'))).text()).toBe('document');
    });

    it('refuses a signed upload URL as permission to download a private file', async () => {
      expect((await serve(sign('documents', 'd.txt', 'PUT'))).status).toBe(403);
    });

    it('sets the disposition a signed URL asks for, and ignores it on an unsigned one', async () => {
      const signed = await serve(sign('avatars', 'me.txt', 'GET', { disposition: 'attachment' }));
      const unsigned = await serve(`${BASE_URL}/avatars/me.txt?disposition=attachment`);

      expect(signed.headers.get('content-disposition')).toBe('attachment');
      expect(unsigned.headers.has('content-disposition')).toBe(false);
    });

    it('sandboxes content a browser would run', async () => {
      await filesOf('avatars').upload('page.html', '<script></script>', { contentType: 'text/html' });

      expect((await serve(`${BASE_URL}/avatars/page.html`)).headers.get('content-security-policy')).toBe('sandbox');
      expect((await serve(`${BASE_URL}/avatars/me.txt`)).headers.has('content-security-policy')).toBe(false);
    });

    it('serves a file of unknown type as a download of bytes', async () => {
      const file = { type: '', size: 3, stream: () => new Response('abc').body };

      buckets.set('untyped', { files: { download: () => Promise.resolve(file) } as unknown as Files, access: 'public' });

      expect((await serve(`${BASE_URL}/untyped/a`)).headers.get('content-type')).toBe('application/octet-stream');
    });

    it('answers 404 for a file that does not exist', async () => {
      const response = await serve(`${BASE_URL}/avatars/missing.txt`);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not found');
    });

    it('lets a storage failure that is not a missing file through', async () => {
      const error = new FilesError('Unauthorized', 'Denied');

      buckets.set('broken', { files: { download: () => Promise.reject(error) } as unknown as Files, access: 'public' });

      await expect(serve(`${BASE_URL}/broken/a.txt`)).rejects.toBe(error);
    });
  });

  describe('uploads', () => {
    it.each(['avatars', 'documents'])('stores the body sent to a signed upload URL on the %s bucket', async (bucket) => {
      const response = await put(sign(bucket, 'new.txt', 'PUT'), 'uploaded', 'text/plain');

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');

      const file = await filesOf(bucket).download('new.txt');

      expect(await file.text()).toBe('uploaded');
      expect(file.type).toBe('text/plain');
    });

    it('refuses an upload without a valid upload signature, even to a public bucket', async () => {
      expect((await put(`${BASE_URL}/avatars/new.txt`, 'x')).status).toBe(403);
      expect((await put(sign('avatars', 'new.txt', 'GET'), 'x')).status).toBe(403);
      expect((await put(sign('avatars', 'other.txt', 'PUT').replace('other.txt', 'new.txt'), 'x')).status).toBe(403);
    });

    it('holds the upload to the content type it was signed for, whatever its parameters or case', async () => {
      const url = sign('avatars', 'a.png', 'PUT', { 'content-type': 'image/png' });

      const wrong = await put(url, 'x', 'text/plain');

      expect(wrong.status).toBe(403);
      expect(await wrong.text()).toBe('This upload URL only accepts image/png');
      expect((await put(url, 'x', 'IMAGE/PNG; charset=binary')).status).toBe(200);
    });

    it('refuses an upload that sends no content type when one was signed', async () => {
      const url = sign('avatars', 'a.png', 'PUT', { 'content-type': 'image/png' });

      expect((await serve(url, { method: 'PUT', body: new Uint8Array([1, 2, 3]) })).status).toBe(403);
    });

    it('stores an upload with no content type when neither the URL nor the upload names one', async () => {
      const upload = vi.spyOn(filesOf('avatars'), 'upload');

      expect((await serve(sign('avatars', 'a.bin', 'PUT'), { method: 'PUT', body: new Uint8Array([1, 2, 3]) })).status).toBe(200);
      expect(upload).toHaveBeenCalledWith('a.bin', new Uint8Array([1, 2, 3]), { contentType: undefined });
    });

    it('holds the upload to the size it was signed for', async () => {
      const url = sign('avatars', 'a.txt', 'PUT', { 'max-size': '5', 'min-size': '2' });

      const tooBig = await put(url, 'too big');
      const tooSmall = await put(url, 'x');

      expect(tooBig.status).toBe(413);
      expect(await tooBig.text()).toBe('This upload URL accepts at most 5 bytes');
      expect(tooSmall.status).toBe(400);
      expect(await tooSmall.text()).toBe('This upload URL needs at least 2 bytes');
      expect((await put(url, 'fits')).status).toBe(200);
    });
  });

  describe('requests it cannot serve', () => {
    it.each([
      { name: 'outside the storage path', url: 'http://localhost/other/avatars/me.txt' },
      { name: 'without a key', url: `${BASE_URL}/avatars` },
      { name: 'for a bucket that was not declared', url: `${BASE_URL}/invoices/me.txt` },
    ])('answers 404 $name', async ({ url }) => {
      const response = await serve(url);

      expect(response.status).toBe(404);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('refuses a key that climbs out of its bucket', async () => {
      const response = await serve(`${BASE_URL}/avatars/a%2F..%2F..%2Fdocuments%2Fd.txt`);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid file key');
    });

    it.each(['POST', 'DELETE', 'PATCH'])('refuses %s, naming the methods it serves', async (method) => {
      const response = await serve(`${BASE_URL}/avatars/me.txt`, { method });

      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('GET, HEAD, PUT, OPTIONS');
    });
  });
});
