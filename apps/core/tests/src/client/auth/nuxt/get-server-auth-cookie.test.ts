import type { H3Event } from 'h3';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getHeader = vi.hoisted(() => vi.fn());

vi.mock('h3', () => ({ getHeader }));

const { getServerAuthCookie } = await import('#client/auth/nuxt/get-server-auth-cookie.ts');

const event = {} as H3Event;

describe('getServerAuthCookie (nuxt)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the cookie header off the event', () => {
    getHeader.mockReturnValue('session=abc');

    expect(getServerAuthCookie(event)).toEqual({ cookie: 'session=abc' });
    expect(getHeader).toHaveBeenCalledWith(event, 'cookie');
  });

  it('returns an undefined cookie when there is none', () => {
    getHeader.mockReturnValue(undefined);

    expect(getServerAuthCookie(event)).toEqual({ cookie: undefined });
  });
});
