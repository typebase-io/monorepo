import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getCliVersion } from '#helpers/shared/get-cli-version.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getCliVersion', () => {
  let tmp: TempDir;
  let originalArgv: string[];

  beforeEach(() => {
    tmp = createTempDir();
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
    tmp.cleanup();
  });

  it('reads the version of the package the running entrypoint belongs to', () => {
    tmp.write('node_modules/typebase-io-cli/package.json', JSON.stringify({ name: 'typebase-io-cli', version: '0.1.14' }));

    process.argv = ['node', path.join(tmp.path, 'node_modules/typebase-io-cli/dist/esm/src/index.js')];

    expect(getCliVersion()).toBe('0.1.14');
  });

  it('returns undefined when the entrypoint is not inside a known package', () => {
    tmp.write('package.json', JSON.stringify({ name: 'consumer', version: '1.0.0' }));

    process.argv = ['node', path.join(tmp.path, 'index.js')];

    expect(getCliVersion()).toBeUndefined();
  });

  it('returns undefined when there is no entrypoint to walk up from', () => {
    process.argv = ['node'];

    expect(getCliVersion()).toBeUndefined();
  });
});
