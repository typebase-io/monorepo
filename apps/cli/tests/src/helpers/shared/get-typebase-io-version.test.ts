import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTypebaseIoVersion } from '#helpers/shared/get-typebase-io-version.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('getTypebaseIoVersion', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    tmp.write('package.json', JSON.stringify({ name: 'consumer' }));
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('reads the version of the typebase-io installed in the project', async () => {
    tmp.write(
      'node_modules/typebase-io/package.json',
      JSON.stringify({ name: 'typebase-io', version: '0.1.14', exports: { './server': './server.js' } })
    );

    tmp.write('node_modules/typebase-io/server.js', 'module.exports = {};');

    await expect(withCwd(tmp.path, () => getTypebaseIoVersion())).resolves.toBe('0.1.14');
  });

  it('reads the version when the project depends on a nested entry point', async () => {
    tmp.write(
      'node_modules/typebase-io/package.json',
      JSON.stringify({ name: 'typebase-io', version: '3.1.0', exports: { './server': './dist/esm/src/server/index.js' } })
    );

    tmp.write('node_modules/typebase-io/dist/esm/package.json', JSON.stringify({ type: 'module' }));
    tmp.write('node_modules/typebase-io/dist/esm/src/server/index.js', 'export default {};');

    await expect(withCwd(tmp.path, () => getTypebaseIoVersion())).resolves.toBe('3.1.0');
  });

  it('returns undefined when typebase-io is not installed', async () => {
    await expect(withCwd(tmp.path, () => getTypebaseIoVersion())).resolves.toBeUndefined();
  });
});
