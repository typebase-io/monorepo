import type { H3Event } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getHeader = vi.hoisted(() => vi.fn());

vi.mock('h3', () => ({ getHeader }));

const { getServerSession } = await import('#client/auth/nuxt/get-server-session.ts');

const APP_URL = 'https://api.example.com';
const event = {} as H3Event;

describe('getServerSession (nuxt)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null without calling the server when there is no cookie', async () => {
    getHeader.mockReturnValue(undefined);

    await expect(getServerSession(event, APP_URL)).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards the cookie to the get-session endpoint', async () => {
    getHeader.mockReturnValue('session=abc');
    vi.mocked(fetch).mockResolvedValue(Response.json({ session: { id: 's1' }, user: { id: 'u1' } }));

    await getServerSession(event, APP_URL);

    expect(fetch).toHaveBeenCalledWith(`${APP_URL}/api/auth/get-session`, { headers: { cookie: 'session=abc' } });
  });

  it('returns the parsed session', async () => {
    getHeader.mockReturnValue('session=abc');
    vi.mocked(fetch).mockResolvedValue(Response.json({ session: { id: 's1' }, user: { id: 'u1' } }));

    await expect(getServerSession(event, APP_URL)).resolves.toEqual({ session: { id: 's1' }, user: { id: 'u1' } });
  });

  it('returns null when the server responds with an error', async () => {
    getHeader.mockReturnValue('session=abc');
    vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 401 }));

    await expect(getServerSession(event, APP_URL)).resolves.toBeNull();
  });
});
