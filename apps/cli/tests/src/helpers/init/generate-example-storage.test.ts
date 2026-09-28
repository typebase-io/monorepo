import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateExampleStorage } from '#helpers/init/generate-example-storage.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateExampleStorage', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('writes a storage file declaring the vercel provider with a public and a private bucket', async () => {
    await generateExampleStorage(path.join(tmp.path, 'storage.ts'));

    expect(tmp.read('storage.ts')).toEqualTemplate('generate-example-storage', 'default.txt');
  });
});
