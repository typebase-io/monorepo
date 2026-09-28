import { describe, expect, it } from 'vitest';

import { getR2PublicUrlEnvKey } from '#helpers/shared/get-r2-public-url-env-key.ts';

describe('getR2PublicUrlEnvKey', () => {
  it('names the public URL key after the bucket in upper case', () => {
    expect(getR2PublicUrlEnvKey('avatars')).toBe('TYPEBASE_STORAGE_R2_PUBLIC_URL_AVATARS');
  });

  it('turns every dash in the bucket into an underscore, so the key is a valid env name', () => {
    expect(getR2PublicUrlEnvKey('user-profile-images')).toBe('TYPEBASE_STORAGE_R2_PUBLIC_URL_USER_PROFILE_IMAGES');
  });
});
