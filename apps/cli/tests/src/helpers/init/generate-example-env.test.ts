import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateExampleEnv } from '#helpers/init/generate-example-env.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateExampleEnv', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('writes an env file with the schema body commented out', async () => {
    await generateExampleEnv(path.join(tmp.path, 'env.ts'));

    expect(tmp.read('env.ts')).toEqualTemplate('generate-example-env', 'default.txt');
  });
});
