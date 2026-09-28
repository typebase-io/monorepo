import { describe, expect, it } from 'vitest';

import { localStorageObjectUrl } from '#server/storage/local-storage/local-storage-object-url.ts';

describe('localStorageObjectUrl', () => {
  it('puts the bucket and key under the base URL', () => {
    expect(localStorageObjectUrl('http://localhost:8080/storage', 'avatars', 'users/me.png')).toBe(
      'http://localhost:8080/storage/avatars/users/me.png'
    );
  });

  it('escapes each key segment on its own, keeping the slashes between them', () => {
    expect(localStorageObjectUrl('/storage', 'avatars', 'my files/a#b?.png')).toBe('/storage/avatars/my%20files/a%23b%3F.png');
  });
});
