import type { H3Event } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h3 = vi.hoisted(() => ({
  getRequestHeaders: vi.fn(),
  getRequestURL: vi.fn(),
  readRawBody: vi.fn(),
}));

vi.mock('h3', () => h3);

const { proxyToTypebase } = await import('#client/auth/nuxt/proxy-to-typebase.ts');

const APP_URL = 'https://api.example.com';

const event = (method = 'GET') => ({ method }) as H3Event;

const fetchArgs = () => vi.mocked(fetch).mock.calls[0] as [string, RequestInit & { headers: Headers }];

describe('proxyToTypebase (nuxt)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h3.getRequestHeaders.mockReturnValue({});
    h3.getRequestURL.mockReturnValue(new URL('https://app.example.com/api/auth/session'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the path and the query string of the incoming request', async () => {
    h3.getRequestURL.mockReturnValue(new URL('https://app.example.com/api/auth/callback?code=1'));

    await proxyToTypebase(event(), APP_URL);

    expect(fetchArgs()[0]).toBe(`${APP_URL}/api/auth/callback?code=1`);
  });

  it('forwards the method and the headers', async () => {
    h3.getRequestHeaders.mockReturnValue({ cookie: 'session=abc' });

    await proxyToTypebase(event('POST'), APP_URL);

    const [, init] = fetchArgs();

    expect(init.method).toBe('POST');
    expect(init.headers.get('cookie')).toBe('session=abc');
  });

  it('strips the host headers so the target does not see the caller`s origin', async () => {
    h3.getRequestHeaders.mockReturnValue({
      host: 'app.example.com',
      'x-forwarded-host': 'app.example.com',
      'x-forwarded-proto': 'https',
    });

    await proxyToTypebase(event(), APP_URL);

    const [, init] = fetchArgs();

    expect(init.headers.get('host')).toBeNull();
    expect(init.headers.get('x-forwarded-host')).toBeNull();
    expect(init.headers.get('x-forwarded-proto')).toBeNull();
    expect(init.headers.get('accept-encoding')).toBe('identity');
  });

  it('forwards the body of a write request', async () => {
    h3.readRawBody.mockResolvedValue('{"email":"a@b.c"}');

    await proxyToTypebase(event('POST'), APP_URL);

    expect(fetchArgs()[1].body).toBe('{"email":"a@b.c"}');
  });

  it('does not read a body for GET and HEAD', async () => {
    await proxyToTypebase(event('GET'), APP_URL);
    await proxyToTypebase(event('HEAD'), APP_URL);

    expect(h3.readRawBody).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(vi.mocked(fetch).mock.calls[1]?.[1]?.body).toBeUndefined();
  });

  it('returns the upstream response untouched', async () => {
    const upstream = new Response('{"session":null}', { status: 201 });

    vi.mocked(fetch).mockResolvedValue(upstream);

    await expect(proxyToTypebase(event(), APP_URL)).resolves.toBe(upstream);
  });
});
