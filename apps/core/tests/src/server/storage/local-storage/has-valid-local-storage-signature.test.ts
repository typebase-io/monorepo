import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hasValidLocalStorageSignature } from '#server/storage/local-storage/has-valid-local-storage-signature.ts';
import { signLocalStorageUrl } from '#server/storage/local-storage/sign-local-storage-url.ts';

describe('hasValidLocalStorageSignature', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const paramsOf = (url: string) => new URL(url).searchParams;

  const signed = (expiresIn = 60) =>
    paramsOf(
      signLocalStorageUrl({ secret: 'secret', baseUrl: 'http://localhost/storage', method: 'GET', bucket: 'avatars', key: 'me.png', expiresIn })
    );

  const check = (params: URLSearchParams, overrides: Partial<Parameters<typeof hasValidLocalStorageSignature>[0]> = {}) =>
    hasValidLocalStorageSignature({ secret: 'secret', method: 'GET', bucket: 'avatars', key: 'me.png', params, ...overrides });

  it('accepts a URL it signed, until it expires', () => {
    const params = signed(60);

    expect(check(params)).toBe(true);

    vi.advanceTimersByTime(60_000);

    expect(check(params)).toBe(true);

    vi.advanceTimersByTime(1);

    expect(check(params)).toBe(false);
  });

  it.each([
    { name: 'another secret', overrides: { secret: 'other' } },
    { name: 'another method', overrides: { method: 'PUT' as const } },
    { name: 'another bucket', overrides: { bucket: 'documents' } },
    { name: 'another key', overrides: { key: 'you.png' } },
  ])('refuses it for $name', ({ overrides }) => {
    expect(check(signed(), overrides)).toBe(false);
  });

  it('refuses it when a signed param was changed', () => {
    const params = signed();

    params.set('expires', String(Number(params.get('expires')) + 3600));

    expect(check(params)).toBe(false);
  });

  it.each([
    {
      name: 'no signature',
      change: (params: URLSearchParams) => {
        params.delete('signature');
      },
    },
    {
      name: 'no expiry',
      change: (params: URLSearchParams) => {
        params.delete('expires');
      },
    },
    {
      name: 'an expiry that is not a whole number',
      change: (params: URLSearchParams) => {
        params.set('expires', 'soon');
      },
    },
    {
      name: 'a truncated signature',
      change: (params: URLSearchParams) => {
        params.set('signature', (params.get('signature') ?? '').slice(2));
      },
    },
    {
      name: 'a signature that is not hex',
      change: (params: URLSearchParams) => {
        params.set('signature', 'z'.repeat(64));
      },
    },
  ])('refuses a URL with $name', ({ change }) => {
    const params = signed();

    change(params);

    expect(check(params)).toBe(false);
  });
});
