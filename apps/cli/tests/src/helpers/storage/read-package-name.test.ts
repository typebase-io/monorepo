import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readPackageName } from '#helpers/storage/read-package-name.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('readPackageName', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('reads the name the project package declares', async () => {
    tmp.write('package.json', JSON.stringify({ name: '@acme/app' }));

    await expect(withCwd(tmp.path, () => readPackageName())).resolves.toBe('@acme/app');
  });

  it('is undefined when the package declares no name', async () => {
    tmp.write('package.json', '{}');

    await expect(withCwd(tmp.path, () => readPackageName())).resolves.toBeUndefined();
  });

  it('is undefined instead of failing when there is no package.json', async () => {
    await expect(withCwd(tmp.path, () => readPackageName())).resolves.toBeUndefined();
  });
});
