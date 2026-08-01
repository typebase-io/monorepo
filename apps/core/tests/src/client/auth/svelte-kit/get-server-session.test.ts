import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

import { getServerSession } from '#client/auth/svelte-kit/get-server-session.ts';

const APP_URL = 'https://api.example.com';

const requestEvent = (headers: Record<string, string> = {}) => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ session: { id: 's1' }, user: { id: 'u1' } }));

  const event = {
    url: new URL('https://app.example.com/'),
    request: new Request('https://app.example.com/', { headers }),
    fetch: fetchMock,
  } as unknown as RequestEvent;

  return { event, fetchMock };
};

describe('getServerSession (svelte-kit)', () => {
  it('returns null without calling the server when there is no cookie', async () => {
    const { event, fetchMock } = requestEvent();

    await expect(getServerSession(event, APP_URL)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the cookie to the get-session endpoint through the event fetch', async () => {
    const { event, fetchMock } = requestEvent({ cookie: 'session=abc' });

    await getServerSession(event, APP_URL);

    expect(fetchMock).toHaveBeenCalledWith(`${APP_URL}/api/auth/get-session`, { headers: { cookie: 'session=abc' } });
  });

  it('returns the parsed session', async () => {
    const { event } = requestEvent({ cookie: 'session=abc' });

    await expect(getServerSession(event, APP_URL)).resolves.toEqual({ session: { id: 's1' }, user: { id: 'u1' } });
  });

  it('returns null when the server responds with an error', async () => {
    const { event, fetchMock } = requestEvent({ cookie: 'session=abc' });

    fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));

    await expect(getServerSession(event, APP_URL)).resolves.toBeNull();
  });
});
