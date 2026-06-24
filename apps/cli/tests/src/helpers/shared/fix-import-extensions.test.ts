import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fixImportExtensions } from '#helpers/shared/fix-import-extensions.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('fixImportExtensions', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('adds .js extensions to relative imports when targeting js', async () => {
    tmp.write('helper.ts', 'export const x = 1;');
    tmp.write('index.ts', `import { x } from './helper';\nexport { x };`);

    await fixImportExtensions(tmp.path, 'js');

    expect(tmp.read('index.ts')).toContain(`from './helper.js'`);
  });

  it('adds .ts extensions to relative imports when targeting ts', async () => {
    tmp.write('helper.ts', 'export const x = 1;');
    tmp.write('index.ts', `import { x } from './helper';`);

    await fixImportExtensions(tmp.path, 'ts');

    expect(tmp.read('index.ts')).toContain(`from './helper.ts'`);
  });

  it('resolves directory imports to their index file', async () => {
    tmp.write('feature/index.ts', 'export const y = 2;');
    tmp.write('index.ts', `import { y } from './feature';`);

    await fixImportExtensions(tmp.path, 'js');

    expect(tmp.read('index.ts')).toContain(`from './feature/index.js'`);
  });

  it('resolves imports from nested folders', async () => {
    tmp.write('nested/deep/helper.ts', 'export const x = 1;');
    tmp.write('index.ts', `import { x } from './nested/deep/helper';`);

    await fixImportExtensions(tmp.path, 'js');

    expect(tmp.read('index.ts')).toContain(`from './nested/deep/helper.js'`);
  });

  it('resolves nested folder imports to their index file', async () => {
    tmp.write('nested/feature/index.ts', 'export const y = 2;');
    tmp.write('index.ts', `import { y } from './nested/feature';`);

    await fixImportExtensions(tmp.path, 'js');

    expect(tmp.read('index.ts')).toContain(`from './nested/feature/index.js'`);
  });

  it('rewrites relative imports inside files in nested folders', async () => {
    tmp.write('nested/helper.ts', 'export const x = 1;');
    tmp.write('nested/consumer.ts', `import { x } from './helper';`);

    await fixImportExtensions(tmp.path, 'js');

    expect(tmp.read('nested/consumer.ts')).toContain(`from './helper.js'`);
  });

  it('leaves bare (non-relative) imports untouched', async () => {
    tmp.write('index.ts', `import { z } from 'some-package';`);

    await fixImportExtensions(tmp.path, 'js');

    expect(tmp.read('index.ts')).toContain(`from 'some-package'`);
  });

  it('does not double-append extensions to imports that already have one', async () => {
    tmp.write('helper.ts', 'export const x = 1;');
    tmp.write('index.ts', `import { x } from './helper.js';`);

    await fixImportExtensions(tmp.path, 'js');

    expect(tmp.read('index.ts')).toContain(`from './helper.js'`);
    expect(tmp.read('index.ts')).not.toContain('helper.js.js');
  });
});
