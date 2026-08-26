import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findPackageVersion } from '#helpers/shared/find-package-version.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('findPackageVersion', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns the version of the package that owns the given path', () => {
    tmp.write('pkg/package.json', JSON.stringify({ name: 'typebase-io-cli', version: '1.2.3' }));

    const version = findPackageVersion({ fromPath: path.join(tmp.path, 'pkg/dist/esm/src/index.js'), packageName: 'typebase-io-cli' });

    expect(version).toBe('1.2.3');
  });

  it('walks past package.json files that belong to another package', () => {
    tmp.write('pkg/package.json', JSON.stringify({ name: 'typebase-io-cli', version: '1.2.3' }));
    tmp.write('pkg/dist/esm/package.json', JSON.stringify({ type: 'module' }));
    tmp.write('pkg/dist/package.json', JSON.stringify({ name: 'something-else', version: '9.9.9' }));

    const version = findPackageVersion({ fromPath: path.join(tmp.path, 'pkg/dist/esm/index.js'), packageName: 'typebase-io-cli' });

    expect(version).toBe('1.2.3');
  });

  it('returns undefined when no package.json up the tree matches', () => {
    tmp.write('pkg/package.json', JSON.stringify({ name: 'consumer', version: '1.0.0' }));

    const version = findPackageVersion({ fromPath: path.join(tmp.path, 'pkg/src/index.ts'), packageName: 'typebase-io-cli' });

    expect(version).toBeUndefined();
  });

  it('returns undefined when the owning package.json has no version', () => {
    tmp.write('pkg/package.json', JSON.stringify({ name: 'typebase-io-cli' }));

    const version = findPackageVersion({ fromPath: path.join(tmp.path, 'pkg/src/index.ts'), packageName: 'typebase-io-cli' });

    expect(version).toBeUndefined();
  });

  it('ignores unreadable package.json files', () => {
    tmp.write('pkg/package.json', JSON.stringify({ name: 'typebase-io-cli', version: '1.2.3' }));
    tmp.write('pkg/dist/package.json', '{ not json');

    const version = findPackageVersion({ fromPath: path.join(tmp.path, 'pkg/dist/index.js'), packageName: 'typebase-io-cli' });

    expect(version).toBe('1.2.3');
  });
});
