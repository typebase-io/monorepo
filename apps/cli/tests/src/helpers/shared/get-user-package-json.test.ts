import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getUserPackageJson } from '#helpers/shared/get-user-package-json.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getUserPackageJson', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('reads and parses the package.json in the start directory', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { foo: '1.0.0' } }));

    const pkg = await getUserPackageJson(tmp.path);

    expect(pkg.dependencies).toEqual({ foo: '1.0.0' });
  });

  it('walks up to find the nearest package.json', async () => {
    tmp.write('package.json', JSON.stringify({ devDependencies: { bar: '2.0.0' } }));

    const nested = tmp.mkdir('a/b/c');
    const pkg = await getUserPackageJson(nested);

    expect(pkg.devDependencies).toEqual({ bar: '2.0.0' });
  });

  it('uses the closest package.json when several exist', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { root: '1.0.0' } }));
    tmp.write('a/package.json', JSON.stringify({ dependencies: { closest: '1.0.0' } }));

    const nested = tmp.mkdir('a/b');
    const pkg = await getUserPackageJson(nested);

    expect(pkg.dependencies).toEqual({ closest: '1.0.0' });
  });

  it('skips a malformed package.json and keeps searching up the tree', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { root: '1.0.0' } }));
    tmp.write('a/package.json', '{ not valid json');

    const nested = tmp.mkdir('a/b');
    const pkg = await getUserPackageJson(nested);

    expect(pkg.dependencies).toEqual({ root: '1.0.0' });
  });

  it('throws when no package.json exists up the tree', async () => {
    const isolated = tmp.mkdir('isolated');

    await expect(getUserPackageJson(path.join(isolated))).rejects.toThrow(/No package\.json found/);
  });
});
