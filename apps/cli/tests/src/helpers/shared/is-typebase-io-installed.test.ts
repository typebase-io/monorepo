import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isTypebaseIoInstalled } from '#helpers/shared/is-typebase-io-installed.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('isTypebaseIoInstalled', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns false when typebase-io cannot be resolved from the project', () => {
    tmp.write('package.json', JSON.stringify({ name: 'consumer' }));

    const result = withCwd(tmp.path, () => isTypebaseIoInstalled());

    return expect(result).resolves.toBe(false);
  });

  it('returns true when typebase-io is installed in the project', () => {
    tmp.write('package.json', JSON.stringify({ name: 'consumer' }));

    tmp.write(
      'node_modules/typebase-io/package.json',
      JSON.stringify({
        name: 'typebase-io',
        version: '0.0.0',
        exports: { './server': './server.js' },
      })
    );

    tmp.write('node_modules/typebase-io/server.js', 'module.exports = {};');

    const result = withCwd(tmp.path, () => isTypebaseIoInstalled());

    return expect(result).resolves.toBe(true);
  });
});
