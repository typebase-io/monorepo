import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateTsConfig', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('writes the tsconfig without the warning header by default', async () => {
    const target = path.join(tmp.path, 'tsconfig.json');

    await generateTsConfig({ path: target, addWarning: false });

    expect(tmp.read('tsconfig.json')).toEqualTemplate('generate-ts-config', 'no-warning.txt');
  });

  it('prepends the auto-generated warning when requested', async () => {
    const target = path.join(tmp.path, 'tsconfig.json');

    await generateTsConfig({ path: target, addWarning: true });

    expect(tmp.read('tsconfig.json')).toEqualTemplate('generate-ts-config', 'warning.txt');
  });
});
