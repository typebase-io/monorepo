import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateExampleAuth } from '#helpers/init/generate-example-auth.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateExampleAuth', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('writes the example auth template with a trailing newline', async () => {
    await generateExampleAuth(path.join(tmp.path, 'auth.ts'));

    expect(tmp.read('auth.ts')).toEqualTemplate('generate-example-auth', 'expected.txt');
  });
});
