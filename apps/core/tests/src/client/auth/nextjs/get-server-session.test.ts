import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const headers = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers }));

const { getServerSession } = await import('#client/auth/nextjs/get-server-session.ts');

const APP_URL = 'https://api.example.com';

describe('getServerSession (next.js)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null without calling the server when there is no cookie', async () => {
    headers.mockResolvedValue(new Headers());

    await expect(getServerSession(APP_URL)).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards the cookie to the get-session endpoint', async () => {
    headers.mockResolvedValue(new Headers({ cookie: 'session=abc' }));

    vi.mocked(fetch).mockResolvedValue(Response.json({ session: { id: 's1' }, user: { id: 'u1' } }));

    await getServerSession(APP_URL);

    expect(fetch).toHaveBeenCalledWith(`${APP_URL}/api/auth/get-session`, {
      headers: { cookie: 'session=abc' },
      cache: 'no-store',
    });
  });

  it('returns the parsed session', async () => {
    headers.mockResolvedValue(new Headers({ cookie: 'session=abc' }));

    vi.mocked(fetch).mockResolvedValue(Response.json({ session: { id: 's1' }, user: { id: 'u1' } }));

    await expect(getServerSession(APP_URL)).resolves.toEqual({ session: { id: 's1' }, user: { id: 'u1' } });
  });

  it('returns null when the server responds with an error', async () => {
    headers.mockResolvedValue(new Headers({ cookie: 'session=abc' }));

    vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 401 }));

    await expect(getServerSession(APP_URL)).resolves.toBeNull();
  });
});
