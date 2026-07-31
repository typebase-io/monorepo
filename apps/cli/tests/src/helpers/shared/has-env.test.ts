import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasEnv } from '#helpers/shared/has-env.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('hasEnv', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns true when the env file exists', () => {
    const envPath = tmp.write('env.ts', 'export const env = {};');

    expect(hasEnv(envPath)).toBe(true);
  });

  it('returns false when the env file is missing', () => {
    expect(hasEnv(path.join(tmp.path, 'env.ts'))).toBe(false);
  });
});
