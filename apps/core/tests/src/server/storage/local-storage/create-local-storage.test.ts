import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStorage } from '#server/storage/create-storage.ts';
import { defineStorage } from '#server/storage/define-storage.ts';
import { createLocalStorage } from '#server/storage/local-storage/create-local-storage.ts';

const URL_BASE = 'http://127.0.0.1:8080/storage';

const config = defineStorage({
  provider: 'vercel',
  buckets: {
    avatars: { access: 'public' },
    documents: { access: 'private' },
    invoices: { access: 'private', prefix: 'billing' },
  },
});

describe('createLocalStorage', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'typebase-local-storage-test-'));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(root, { recursive: true, force: true });
  });

  const setup = ({ url = URL_BASE, storageRoot = root }: { url?: string; storageRoot?: string } = {}) => {
    const local = createLocalStorage({ root: storageRoot, url });
    const storage = createStorage(config, { local });

    return { local, storage };
  };

  const get = (local: ReturnType<typeof createLocalStorage>, url: string, init?: RequestInit) => local.handle(new Request(url, init));

  const withSearchParam = (url: string, name: string, value: string) => {
    const parsed = new URL(url);

    parsed.searchParams.set(name, value);

    return parsed.toString();
  };

  describe('public buckets', () => {
    it('builds a permanent URL from the local origin and the storage path', async () => {
      const { storage } = setup();

      expect(await storage.bucket('avatars').publicUrl('users/me.png')).toBe(`${URL_BASE}/avatars/users/me.png`);
    });

    it('serves a file at its permanent URL without a signature', async () => {
      const { local, storage } = setup();

      await storage.bucket('avatars').upload('users/me.txt', 'hello', { contentType: 'text/plain' });

      const response = await get(local, await storage.bucket('avatars').publicUrl('users/me.txt'));

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/plain');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(await response.text()).toBe('hello');
    });

    it('round-trips keys that need escaping in a URL', async () => {
      const { local, storage } = setup();
      const key = 'a folder/ünïcode #1?.txt';

      await storage.bucket('avatars').upload(key, 'escaped');

      const url = await storage.bucket('avatars').publicUrl(key);

      expect(url).toBe(`${URL_BASE}/avatars/a%20folder/%C3%BCn%C3%AFcode%20%231%3F.txt`);
      expect(await (await get(local, url)).text()).toBe('escaped');
    });

    it('answers a HEAD request with the headers and no body', async () => {
      const { local, storage } = setup();

      await storage.bucket('avatars').upload('a.txt', 'hello', { contentType: 'text/plain' });

      const response = await get(local, await storage.bucket('avatars').publicUrl('a.txt'), { method: 'HEAD' });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-length')).toBe('5');
      expect(await response.text()).toBe('');
    });

    it('answers 404 for a file that does not exist', async () => {
      const { local, storage } = setup();

      expect((await get(local, await storage.bucket('avatars').publicUrl('missing.txt'))).status).toBe(404);
    });

    it('works whatever host the request came in on', async () => {
      const { local, storage } = setup();

      await storage.bucket('avatars').upload('a.txt', 'hello');

      expect((await get(local, 'http://localhost:8080/storage/avatars/a.txt')).status).toBe(200);
      expect((await storage.bucket('avatars').publicUrl('a.txt')).startsWith(URL_BASE)).toBe(true);
    });

    it('builds URLs relative to the page when given only a path', async () => {
      const { local, storage } = setup({ url: '/files/' });

      await storage.bucket('avatars').upload('a.txt', 'hello');
      await storage.bucket('documents').upload('d.txt', 'secret');

      const publicUrl = await storage.bucket('avatars').publicUrl('a.txt');
      const signedUrl = await storage.bucket('documents').signedUrl('d.txt');

      expect(publicUrl).toBe('/files/avatars/a.txt');
      expect(signedUrl.startsWith('/files/documents/d.txt?')).toBe(true);
      expect(await (await get(local, new URL(publicUrl, 'http://localhost:3000').toString())).text()).toBe('hello');
      expect(await (await get(local, new URL(signedUrl, 'http://localhost:3000').toString())).text()).toBe('secret');
    });

    it('serves under whatever path the URL it was given ends in', async () => {
      const { local, storage } = setup({ url: 'http://127.0.0.1:3000/files/' });

      await storage.bucket('avatars').upload('a.txt', 'hello');

      const url = await storage.bucket('avatars').publicUrl('a.txt');

      expect(url).toBe('http://127.0.0.1:3000/files/avatars/a.txt');
      expect(await (await get(local, url)).text()).toBe('hello');
    });
  });

  describe('active content', () => {
    it.each([
      ['page.html', 'text/html'],
      ['icon.svg', 'image/svg+xml'],
      ['feed.xml', 'application/xml'],
    ])('sandboxes %s so its scripts never run on the server origin', async (key, contentType) => {
      const { local, storage } = setup();

      await storage.bucket('avatars').upload(key, '<script>alert(1)</script>', { contentType });

      const response = await get(local, await storage.bucket('avatars').publicUrl(key));

      expect(response.status).toBe(200);
      expect(response.headers.get('content-security-policy')).toBe('sandbox');
    });

    it('leaves passive content alone', async () => {
      const { local, storage } = setup();

      await storage.bucket('avatars').upload('me.png', 'png', { contentType: 'image/png' });

      expect((await get(local, await storage.bucket('avatars').publicUrl('me.png'))).headers.get('content-security-policy')).toBeNull();
    });
  });

  describe('private buckets', () => {
    it('serves a file at its signed URL until the URL expires', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const { local, storage } = setup();

      await storage.bucket('documents').upload('d.txt', 'secret', { contentType: 'text/plain' });

      const url = await storage.bucket('documents').signedUrl('d.txt', { expiresIn: 60 });

      expect(url.startsWith(`${URL_BASE}/documents/d.txt?`)).toBe(true);
      expect(await (await get(local, url)).text()).toBe('secret');

      vi.setSystemTime(new Date('2026-01-01T00:00:59Z'));

      expect((await get(local, url)).status).toBe(200);

      vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));

      expect((await get(local, url)).status).toBe(403);
    });

    it('expires signed URLs after an hour when no expiry is given', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const { local, storage } = setup();

      await storage.bucket('documents').upload('d.txt', 'secret');

      const url = await storage.bucket('documents').signedUrl('d.txt');

      vi.setSystemTime(new Date('2026-01-01T00:59:59Z'));

      expect((await get(local, url)).status).toBe(200);

      vi.setSystemTime(new Date('2026-01-01T01:00:01Z'));

      expect((await get(local, url)).status).toBe(403);
    });

    it('refuses a private file without a signature', async () => {
      const { local, storage } = setup();

      await storage.bucket('documents').upload('d.txt', 'secret');

      expect((await get(local, `${URL_BASE}/documents/d.txt`)).status).toBe(403);
    });

    it.each([
      ['signature', 'the signature', (url: string) => withSearchParam(url, 'signature', '0'.repeat(64))],
      ['expires', 'the expiry', (url: string) => withSearchParam(url, 'expires', String(Number(new URL(url).searchParams.get('expires')) + 3600))],
      ['key', 'the key', (url: string) => url.replace('/d.txt?', '/other.txt?')],
      ['bucket', 'the bucket', (url: string) => url.replace('/documents/', '/invoices/')],
      ['extra', 'an added parameter', (url: string) => withSearchParam(url, 'disposition', 'inline')],
    ])('refuses a signed URL whose %s was changed', async (_name, _label, tamper) => {
      const { local, storage } = setup();

      await storage.bucket('documents').upload('d.txt', 'secret');
      await storage.bucket('documents').upload('other.txt', 'other');
      await storage.bucket('invoices').upload('d.txt', 'invoice');

      const url = await storage.bucket('documents').signedUrl('d.txt');

      expect((await get(local, tamper(url))).status).toBe(403);
    });

    it('asks the browser to download when the signed URL says so', async () => {
      const { local, storage } = setup();

      await storage.bucket('documents').upload('d.html', '<p>hi</p>', { contentType: 'text/html' });

      const url = await storage.bucket('documents').signedUrl('d.html', { responseContentDisposition: 'attachment; filename="d.html"' });
      const response = await get(local, url);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-disposition')).toBe('attachment; filename="d.html"');
    });

    it('honours an expiry shorter than a second', async () => {
      const { local, storage } = setup();

      await storage.bucket('documents').upload('d.txt', 'secret');

      expect((await get(local, await storage.bucket('documents').signedUrl('d.txt', { expiresIn: 0.5 }))).status).toBe(200);
    });

    it.each([0, -60, Number.NaN, Number.POSITIVE_INFINITY])('rejects an expiry of %s', async (expiresIn) => {
      const { storage } = setup();

      await expect(storage.bucket('documents').signedUrl('d.txt', { expiresIn })).rejects.toThrow(
        `A signed URL needs a positive, finite \`expiresIn\` in seconds, not ${expiresIn}.`
      );
      await expect(storage.bucket('documents').signedUploadUrl('d.txt', { expiresIn })).rejects.toThrow(
        `A signed URL needs a positive, finite \`expiresIn\` in seconds, not ${expiresIn}.`
      );
    });

    it("serves a bucket's files under its prefix", async () => {
      const { local, storage } = setup();

      await storage.bucket('invoices').upload('i.txt', 'invoice');

      expect(await (await get(local, await storage.bucket('invoices').signedUrl('i.txt'))).text()).toBe('invoice');
    });
  });

  describe('signed uploads', () => {
    const put = (local: ReturnType<typeof createLocalStorage>, url: string, body: string, headers: Record<string, string> = {}) =>
      get(local, url, { method: 'PUT', body, headers });

    it.each(['avatars', 'documents'] as const)('accepts an upload to a signed upload URL on the %s bucket', async (bucket) => {
      const { local, storage } = setup();

      const upload = await storage.bucket(bucket).signedUploadUrl('new.txt', { expiresIn: 60 });

      expect(upload.method).toBe('PUT');
      expect(upload.url.startsWith(`${URL_BASE}/${bucket}/new.txt?`)).toBe(true);

      const response = await put(local, upload.url, 'uploaded', { 'content-type': 'text/plain' });

      expect(response.status).toBe(200);

      const file = await storage.bucket(bucket).download('new.txt');

      expect(await file.text()).toBe('uploaded');
      expect(file.type).toBe('text/plain');
    });

    it('refuses an upload once the URL has expired', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const { local, storage } = setup();

      const { url } = await storage.bucket('documents').signedUploadUrl('new.txt', { expiresIn: 60 });

      vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));

      expect((await put(local, url, 'late')).status).toBe(403);
      expect(await storage.bucket('documents').exists('new.txt')).toBe(false);
    });

    it('refuses an upload to a key the URL was not signed for', async () => {
      const { local, storage } = setup();

      const { url } = await storage.bucket('documents').signedUploadUrl('new.txt', { expiresIn: 60 });

      expect((await put(local, url.replace('/new.txt?', '/other.txt?'), 'sneaky')).status).toBe(403);
      expect(await storage.bucket('documents').exists('other.txt')).toBe(false);
    });

    it('refuses an upload without a signature, even to a public bucket', async () => {
      const { local, storage } = setup();

      expect((await put(local, `${URL_BASE}/avatars/new.txt`, 'unsigned')).status).toBe(403);
      expect(await storage.bucket('avatars').exists('new.txt')).toBe(false);
    });

    it('refuses to take a signed download URL as permission to upload', async () => {
      const { local, storage } = setup();

      await storage.bucket('documents').upload('d.txt', 'original');

      const url = await storage.bucket('documents').signedUrl('d.txt');

      expect((await put(local, url, 'overwritten')).status).toBe(403);
      expect(await (await storage.bucket('documents').download('d.txt')).text()).toBe('original');
    });

    it('refuses to take a signed upload URL as permission to download', async () => {
      const { local, storage } = setup();

      await storage.bucket('documents').upload('d.txt', 'secret');

      const { url } = await storage.bucket('documents').signedUploadUrl('d.txt', { expiresIn: 60 });

      expect((await get(local, url)).status).toBe(403);
    });

    it('holds the upload to the content type it was signed for, and tells the browser which to send', async () => {
      const { local, storage } = setup();

      const upload = await storage.bucket('avatars').signedUploadUrl('me.png', { expiresIn: 60, contentType: 'image/png' });

      expect(upload).toEqual({ method: 'PUT', url: expect.any(String) as string, headers: { 'Content-Type': 'image/png' } });
      expect((await put(local, upload.url, 'html', { 'content-type': 'text/html' })).status).toBe(403);
      expect((await put(local, upload.url, 'png', { 'content-type': 'image/png' })).status).toBe(200);
    });

    it('stops reading an upload as soon as it passes the size it was signed for', async () => {
      const { local, storage } = setup();

      const { url } = await storage.bucket('avatars').signedUploadUrl('big.bin', { expiresIn: 60, maxSize: 4 });

      const endless = new ReadableStream<Uint8Array>({
        start: (controller) => {
          controller.enqueue(new Uint8Array(10));
        },
      });

      const response = await local.handle(new Request(url, { method: 'PUT', body: endless, duplex: 'half' } as RequestInit));

      expect(response.status).toBe(413);
      expect(await storage.bucket('avatars').exists('big.bin')).toBe(false);
    });

    it('holds the upload to the size it was signed for', async () => {
      const { local, storage } = setup();

      const { url } = await storage.bucket('avatars').signedUploadUrl('me.txt', { expiresIn: 60, maxSize: 4 });

      expect((await put(local, url, 'too large')).status).toBe(413);
      expect((await put(local, url, '')).status).toBe(400);
      expect(await storage.bucket('avatars').exists('me.txt')).toBe(false);
      expect((await put(local, url, 'fits')).status).toBe(200);
    });
  });

  describe('requests it cannot serve', () => {
    it('answers 404 for a bucket that was not declared', async () => {
      const { local } = setup();

      expect((await get(local, `${URL_BASE}/unknown/a.txt`)).status).toBe(404);
    });

    it('answers 404 outside the storage path, or without a key', async () => {
      const { local } = setup();

      expect((await get(local, 'http://127.0.0.1:8080/elsewhere/avatars/a.txt')).status).toBe(404);
      expect((await get(local, `${URL_BASE}/avatars`)).status).toBe(404);
      expect((await get(local, `${URL_BASE}/avatars/`)).status).toBe(404);
    });

    it('refuses a key that climbs out of its bucket', async () => {
      const { local, storage } = setup();

      await storage.bucket('documents').upload('d.txt', 'secret');

      expect((await get(local, `${URL_BASE}/avatars/..%2Fdocuments%2Fd.txt`)).status).toBe(400);
    });

    it('answers 500 without the details when storage fails', async () => {
      const failing = defineStorage({
        provider: 'vercel',
        buckets: {
          avatars: {
            access: 'public',
            plugins: [{ name: 'fail', wrap: (op, next) => (op.kind === 'download' ? Promise.reject(new Error('disk on fire')) : next(op)) }],
          },
        },
      });

      const local = createLocalStorage({ root, url: URL_BASE });
      const storage = createStorage(failing, { local });
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await storage.bucket('avatars').upload('a.txt', 'hello');

      const response = await get(local, await storage.bucket('avatars').publicUrl('a.txt'));

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Storage failed');
      expect(logged).toHaveBeenCalled();
    });

    it('refuses methods it does not serve', async () => {
      const { local } = setup();

      expect((await get(local, `${URL_BASE}/avatars/a.txt`, { method: 'DELETE' })).status).toBe(405);
    });

    it('lets a browser on another origin make the requests', async () => {
      const { local } = setup();

      const response = await get(local, `${URL_BASE}/avatars/a.txt`, {
        method: 'OPTIONS',
        headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'PUT' },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, HEAD, PUT');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
    });
  });

  describe('the root', () => {
    it('resolves a relative root against the working directory the server starts in', async () => {
      const cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
      const { storage } = setup({ storageRoot: '.local-storage' });

      cwd.mockRestore();

      await storage.bucket('avatars').upload('a.txt', 'hello');

      expect(readFileSync(path.join(root, '.local-storage', 'avatars', 'a.txt'), 'utf8')).toBe('hello');
    });

    it('keeps itself out of git, wherever it lands', () => {
      setup();

      expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).toBe('*\n');
    });

    it('leaves a .gitignore the developer changed alone', () => {
      writeFileSync(path.join(root, '.gitignore'), 'mine\n');

      setup();

      expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).toBe('mine\n');
    });
  });

  describe('the signing secret', () => {
    it('keeps verifying the URLs it signed after a restart on the same root', async () => {
      const first = setup();

      await first.storage.bucket('documents').upload('d.txt', 'secret');

      const url = await first.storage.bucket('documents').signedUrl('d.txt');
      const restarted = setup();

      expect((await get(restarted.local, url)).status).toBe(200);
    });

    it('never verifies URLs signed for another root', async () => {
      const otherRoot = mkdtempSync(path.join(tmpdir(), 'typebase-local-storage-test-'));

      try {
        const mine = setup();
        const other = setup({ storageRoot: otherRoot });

        await mine.storage.bucket('documents').upload('d.txt', 'secret');

        const forged = await other.storage.bucket('documents').signedUrl('d.txt');

        expect((await get(mine.local, forged)).status).toBe(403);
      } finally {
        rmSync(otherRoot, { recursive: true, force: true });
      }
    });

    it('refuses a signing secret file it cannot trust, naming it', () => {
      writeFileSync(path.join(root, '.signing-secret'), '');

      expect(() => createLocalStorage({ root, url: URL_BASE })).toThrow(
        `The local storage signing secret in \`${path.join(root, '.signing-secret')}\` is not one Typebase wrote. Delete the file and a new one is created.`
      );
    });

    it('does not sign with the auth secret', async () => {
      vi.stubEnv('BETTER_AUTH_SECRET', 'auth-secret');

      try {
        const first = setup();

        await first.storage.bucket('documents').upload('d.txt', 'secret');

        const url = await first.storage.bucket('documents').signedUrl('d.txt');

        vi.stubEnv('BETTER_AUTH_SECRET', 'another-auth-secret');

        expect((await get(setup().local, url)).status).toBe(200);
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
