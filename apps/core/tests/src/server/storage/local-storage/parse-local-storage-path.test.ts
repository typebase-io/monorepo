import { describe, expect, it } from 'vitest';

import { parseLocalStoragePath } from '#server/storage/local-storage/parse-local-storage-path.ts';

describe('parseLocalStoragePath', () => {
  it('reads the bucket and key under the base path', () => {
    expect(parseLocalStoragePath('/storage/avatars/users/me.png', '/storage')).toEqual({ bucket: 'avatars', key: 'users/me.png' });
  });

  it('decodes an escaped bucket and key', () => {
    expect(parseLocalStoragePath('/storage/avatars/my%20files/a%23b.png', '/storage')).toEqual({ bucket: 'avatars', key: 'my files/a#b.png' });
  });

  it('reads paths under an empty base path', () => {
    expect(parseLocalStoragePath('/avatars/me.png', '')).toEqual({ bucket: 'avatars', key: 'me.png' });
  });

  it.each([
    { name: 'outside the base path', pathname: '/other/avatars/me.png' },
    { name: 'the base path itself', pathname: '/storage' },
    { name: 'a sibling that shares the prefix', pathname: '/storage-old/avatars/me.png' },
    { name: 'a bucket without a key', pathname: '/storage/avatars' },
    { name: 'a key ending in a slash', pathname: '/storage/avatars/users/' },
    { name: 'an empty bucket', pathname: '/storage//me.png' },
  ])('is not found for $name', ({ pathname }) => {
    expect(parseLocalStoragePath(pathname, '/storage')).toBe('not-found');
  });

  it.each([
    { name: 'climbs out of its bucket', pathname: '/storage/avatars/../documents/secret.pdf' },
    { name: 'climbs out once decoded', pathname: '/storage/avatars/%2E%2E/secret.pdf' },
    { name: 'hides a slash that would climb out', pathname: '/storage/avatars/a%2F..%2F..%2Fsecret.pdf' },
    { name: 'names the current directory', pathname: '/storage/avatars/./me.png' },
    { name: 'has an empty segment', pathname: '/storage/avatars/users//me.png' },
    { name: 'cannot be decoded', pathname: '/storage/avatars/%E0%A4%A.png' },
  ])('refuses a key that $name', ({ pathname }) => {
    expect(parseLocalStoragePath(pathname, '/storage')).toBe('bad-key');
  });
});
