import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { proxyToTypebase } from '#client/auth/nextjs/proxy-to-typebase.ts';

const APP_URL = 'https://api.example.com';

const nextRequest = (url: string, init?: RequestInit) => new Request(url, init) as unknown as NextRequest;

const fetchArgs = () => vi.mocked(fetch).mock.calls[0] as [string, RequestInit & { headers: Headers }];

describe('proxyToTypebase (next.js)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the path and the query string of the incoming request', async () => {
    await proxyToTypebase(nextRequest('https://app.example.com/api/auth/callback?code=1'), APP_URL);

    expect(fetchArgs()[0]).toBe(`${APP_URL}/api/auth/callback?code=1`);
  });

  it('forwards the method and the headers', async () => {
    await proxyToTypebase(nextRequest('https://app.example.com/api/auth/sign-in', { method: 'POST', headers: { cookie: 'session=abc' } }), APP_URL);

    const [, init] = fetchArgs();

    expect(init.method).toBe('POST');
    expect(init.headers.get('cookie')).toBe('session=abc');
  });

  it('strips the host headers so the target does not see the caller`s origin', async () => {
    const request = nextRequest('https://app.example.com/api/auth/session', {
      headers: { host: 'app.example.com', 'x-forwarded-host': 'app.example.com', 'x-forwarded-proto': 'https' },
    });

    await proxyToTypebase(request, APP_URL);

    const [, init] = fetchArgs();

    expect(init.headers.get('host')).toBeNull();
    expect(init.headers.get('x-forwarded-host')).toBeNull();
    expect(init.headers.get('x-forwarded-proto')).toBeNull();
    expect(init.headers.get('accept-encoding')).toBe('identity');
  });

  it('forwards the body of a write request', async () => {
    await proxyToTypebase(nextRequest('https://app.example.com/api/auth/sign-in', { method: 'POST', body: '{"email":"a@b.c"}' }), APP_URL);

    const [, init] = fetchArgs();

    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"email":"a@b.c"}');
  });

  it('does not send a body for GET and HEAD', async () => {
    await proxyToTypebase(nextRequest('https://app.example.com/api/auth/session'), APP_URL);
    await proxyToTypebase(nextRequest('https://app.example.com/api/auth/session', { method: 'HEAD' }), APP_URL);

    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(vi.mocked(fetch).mock.calls[1]?.[1]?.body).toBeUndefined();
  });

  it('returns the upstream status and body', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"session":null}', { status: 201, headers: { 'set-cookie': 'session=abc' } }));

    const response = await proxyToTypebase(nextRequest('https://app.example.com/api/auth/session'), APP_URL);

    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toBe('session=abc');
    await expect(response.text()).resolves.toBe('{"session":null}');
  });
});
