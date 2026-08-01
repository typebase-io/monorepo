import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';

import { getServerAuthCookie } from '#client/auth/svelte-kit/get-server-auth-cookie.ts';

const requestEvent = (headers: Record<string, string> = {}) =>
  ({
    url: new URL('https://app.example.com/'),
    request: new Request('https://app.example.com/', { headers }),
  }) as unknown as RequestEvent;

describe('getServerAuthCookie (svelte-kit)', () => {
  it('returns the incoming cookie header', () => {
    expect(getServerAuthCookie(requestEvent({ cookie: 'session=abc' }))).toEqual({ cookie: 'session=abc' });
  });

  it('returns an undefined cookie when there is none', () => {
    expect(getServerAuthCookie(requestEvent())).toEqual({ cookie: undefined });
  });
});
