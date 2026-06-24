import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveRelativeImport } from '#helpers/shared/resolve-relative-import.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('resolveRelativeImport', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('resolves a sibling source file, preserving the .ts extension', () => {
    tmp.write('foo.ts', '');
    const fromFile = path.join(tmp.path, 'index.ts');

    expect(resolveRelativeImport(fromFile, './foo', 'ts')).toBe('./foo.ts');
  });

  it('rewrites the extension to .js when targeting js output', () => {
    tmp.write('foo.ts', '');
    const fromFile = path.join(tmp.path, 'index.ts');

    expect(resolveRelativeImport(fromFile, './foo', 'js')).toBe('./foo.js');
  });

  it('resolves a directory to its index file', () => {
    tmp.write('foo/index.ts', '');
    const fromFile = path.join(tmp.path, 'index.ts');

    expect(resolveRelativeImport(fromFile, './foo', 'ts')).toBe('./foo/index.ts');
    expect(resolveRelativeImport(fromFile, './foo', 'js')).toBe('./foo/index.js');
  });

  it('preserves the original source extension (e.g. .tsx)', () => {
    tmp.write('foo.tsx', '');
    const fromFile = path.join(tmp.path, 'index.ts');

    expect(resolveRelativeImport(fromFile, './foo', 'ts')).toBe('./foo.tsx');
    expect(resolveRelativeImport(fromFile, './foo', 'js')).toBe('./foo.tsx');
  });

  it('maps .mts and .cts sources to .mjs and .cjs when targeting js', () => {
    tmp.write('esm.mts', '');
    tmp.write('cjs.cts', '');
    const fromFile = path.join(tmp.path, 'index.ts');

    expect(resolveRelativeImport(fromFile, './esm', 'js')).toBe('./esm.mjs');
    expect(resolveRelativeImport(fromFile, './cjs', 'js')).toBe('./cjs.cjs');
  });

  it('falls back to a default extension when nothing matches', () => {
    const fromFile = path.join(tmp.path, 'index.ts');

    expect(resolveRelativeImport(fromFile, './missing', 'ts')).toBe('./missing.ts');
    expect(resolveRelativeImport(fromFile, './missing', 'js')).toBe('./missing.js');
  });
});
