import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { localStorageSignature } from '#server/storage/local-storage/local-storage-signature.ts';
import { signLocalStorageUrl } from '#server/storage/local-storage/sign-local-storage-url.ts';

describe('signLocalStorageUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sign = (overrides: Partial<Parameters<typeof signLocalStorageUrl>[0]> = {}) =>
    new URL(
      signLocalStorageUrl({
        secret: 'secret',
        baseUrl: 'http://localhost:8080/storage',
        method: 'GET',
        bucket: 'avatars',
        key: 'users/me.png',
        expiresIn: 60,
        ...overrides,
      })
    );

  it('points at the object and expires the given number of seconds from now', () => {
    const url = sign();

    expect(`${url.origin}${url.pathname}`).toBe('http://localhost:8080/storage/avatars/users/me.png');
    expect(url.searchParams.get('expires')).toBe('1060');
  });

  it('rounds an expiry shorter than a second up to the next second', () => {
    expect(sign({ expiresIn: 0.5 }).searchParams.get('expires')).toBe('1001');
  });

  it('signs the method, bucket, key and params it carries', () => {
    const url = sign({ method: 'PUT', params: { 'content-type': 'image/png' } });

    expect(url.searchParams.get('signature')).toBe(
      localStorageSignature({ secret: 'secret', method: 'PUT', bucket: 'avatars', key: 'users/me.png', params: url.searchParams })
    );
  });

  it('carries only the params that have a value', () => {
    expect([...sign({ params: { disposition: 'attachment', 'max-size': undefined } }).searchParams.keys()]).toEqual([
      'expires',
      'disposition',
      'signature',
    ]);
  });

  it.each([0, -60, Number.NaN, Number.POSITIVE_INFINITY])('rejects an expiry of %s', (expiresIn) => {
    expect(() => sign({ expiresIn })).toThrow(`A signed URL needs a positive, finite \`expiresIn\` in seconds, not ${expiresIn}.`);
  });
});
