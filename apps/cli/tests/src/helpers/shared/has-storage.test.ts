import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasStorage } from '#helpers/shared/has-storage.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('hasStorage', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('is true when the project has a storage file', () => {
    tmp.write('storage.ts', 'export const storage = {};');

    expect(hasStorage(path.join(tmp.path, 'storage.ts'))).toBe(true);
  });

  it('is false when it does not', () => {
    expect(hasStorage(path.join(tmp.path, 'storage.ts'))).toBe(false);
  });
});
