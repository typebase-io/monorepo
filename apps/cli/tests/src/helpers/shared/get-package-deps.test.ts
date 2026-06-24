import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getPackageDeps } from '#helpers/shared/get-package-deps.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getPackageDeps', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('collects external dependencies from imports, re-exports, dynamic imports and requires', async () => {
    tmp.write(
      'package.json',
      JSON.stringify({
        dependencies: { 'known-pkg': '1.2.3' },
        devDependencies: { '@scope/pkg': '4.5.6' },
      })
    );

    tmp.write(
      'src/index.ts',
      [
        `import { a } from 'known-pkg';`,
        `import { b } from 'unknown-pkg';`,
        `import scoped from '@scope/pkg/deep';`,
        `import bareScope from '@only-scope';`,
        `import './local';`,
        `import '#alias/thing';`,
        `import '/absolute';`,
        `import 'node:path';`,
        `import 'fs';`,
        `import '';`,
        `export { c } from 'reexport-pkg';`,
        `export const local = 1;`,
        `const localThing = 1;`,
        `export { localThing };`,
        `const dyn = import('dynamic-pkg');`,
        `const dynVar = import(local as unknown as string);`,
        `const req = require('require-pkg');`,
        `const reqVar = require(local as unknown as string);`,
        `import { d } from 'known-pkg';`,
      ].join('\n')
    );

    const deps = await getPackageDeps({ sourceDirPath: path.join(tmp.path, 'src') });

    expect(deps).toEqual({
      'known-pkg': '1.2.3',
      'unknown-pkg': '*',
      '@scope/pkg': '4.5.6',
      '@only-scope/': '*',
      'reexport-pkg': '*',
      'dynamic-pkg': '*',
      'require-pkg': '*',
    });
  });

  it('honours a custom skipDirs predicate', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: {} }));
    tmp.write('src/index.ts', `import { a } from 'kept-pkg';`);
    tmp.write('src/ignored/other.ts', `import { b } from 'skipped-pkg';`);

    const deps = await getPackageDeps({
      sourceDirPath: path.join(tmp.path, 'src'),
      skipDirs: (name) => name === 'ignored',
    });

    expect(deps).toEqual({ 'kept-pkg': '*' });
  });
});
