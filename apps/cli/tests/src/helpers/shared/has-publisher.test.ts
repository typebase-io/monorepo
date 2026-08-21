import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasPublisher } from '#helpers/shared/has-publisher.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('hasPublisher', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('is true when the project has a publisher file', () => {
    tmp.write('publisher.ts', 'export const publisher = {};');

    expect(hasPublisher(path.join(tmp.path, 'publisher.ts'))).toBe(true);
  });

  it('is false when it does not', () => {
    expect(hasPublisher(path.join(tmp.path, 'publisher.ts'))).toBe(false);
  });
});
