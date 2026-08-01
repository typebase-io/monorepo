import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

import { proxyToTypebase } from '#client/auth/svelte-kit/proxy-to-typebase.ts';

const APP_URL = 'https://api.example.com';

const requestEvent = (url: string, init?: RequestInit) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

  const event = {
    url: new URL(url),
    request: new Request(url, init),
    fetch: fetchMock,
  } as unknown as RequestEvent;

  return { event, fetchMock };
};

describe('proxyToTypebase (svelte-kit)', () => {
  it('uses the event fetch so cookies stay in the sveltekit request context', async () => {
    const { event, fetchMock } = requestEvent('https://app.example.com/api/auth/session');

    await proxyToTypebase(event, APP_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the path and the query string of the incoming request', async () => {
    const { event, fetchMock } = requestEvent('https://app.example.com/api/auth/callback?code=1');

    await proxyToTypebase(event, APP_URL);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${APP_URL}/api/auth/callback?code=1`);
  });

  it('forwards the method and strips the host headers', async () => {
    const { event, fetchMock } = requestEvent('https://app.example.com/api/auth/sign-in', {
      method: 'POST',
      headers: { cookie: 'session=abc', host: 'app.example.com', 'x-forwarded-host': 'app.example.com', 'x-forwarded-proto': 'https' },
    });

    await proxyToTypebase(event, APP_URL);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { headers: Headers };

    expect(init.method).toBe('POST');
    expect(init.headers.get('cookie')).toBe('session=abc');
    expect(init.headers.get('host')).toBeNull();
    expect(init.headers.get('x-forwarded-host')).toBeNull();
    expect(init.headers.get('x-forwarded-proto')).toBeNull();
    expect(init.headers.get('accept-encoding')).toBe('identity');
  });

  it('forwards the body of a write request', async () => {
    const { event, fetchMock } = requestEvent('https://app.example.com/api/auth/sign-in', { method: 'POST', body: '{"email":"a@b.c"}' });

    await proxyToTypebase(event, APP_URL);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"email":"a@b.c"}');
  });

  it('does not send a body for GET and HEAD', async () => {
    const get = requestEvent('https://app.example.com/api/auth/session');
    const head = requestEvent('https://app.example.com/api/auth/session', { method: 'HEAD' });

    await proxyToTypebase(get.event, APP_URL);
    await proxyToTypebase(head.event, APP_URL);

    expect((get.fetchMock.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined();
    expect((head.fetchMock.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined();
  });

  it('returns the upstream response untouched', async () => {
    const { event, fetchMock } = requestEvent('https://app.example.com/api/auth/session');
    const upstream = new Response('{"session":null}', { status: 201 });

    fetchMock.mockResolvedValue(upstream);

    await expect(proxyToTypebase(event, APP_URL)).resolves.toBe(upstream);
  });
});
