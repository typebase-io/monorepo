import { beforeEach, describe, expect, it, vi } from 'vitest';

const headers = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers }));

const { getServerAuthCookie } = await import('#client/auth/nextjs/get-server-auth-cookie.ts');

describe('getServerAuthCookie (next.js)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the incoming cookie header', async () => {
    headers.mockResolvedValue(new Headers({ cookie: 'better-auth.session_token=abc' }));

    await expect(getServerAuthCookie()).resolves.toEqual({ cookie: 'better-auth.session_token=abc' });
  });

  it('returns an empty object when there is no cookie', async () => {
    headers.mockResolvedValue(new Headers());

    await expect(getServerAuthCookie()).resolves.toEqual({});
  });
});
