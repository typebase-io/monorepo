import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasAuth } from '#helpers/shared/has-auth.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('hasAuth', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns true when the auth file exists', () => {
    const authPath = tmp.write('auth.ts', 'export const auth = {};');

    expect(hasAuth(authPath)).toBe(true);
  });

  it('returns false when the auth file is missing', () => {
    expect(hasAuth(path.join(tmp.path, 'auth.ts'))).toBe(false);
  });
});
