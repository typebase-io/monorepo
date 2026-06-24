import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { walk } from '#helpers/shared/walk.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('walk', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns an empty array for a non-existent directory', async () => {
    expect(await walk(path.join(tmp.path, 'does-not-exist'))).toEqual([]);
  });

  it('returns an empty array when given a file path', async () => {
    const file = tmp.write('a.ts', '');

    expect(await walk(file)).toEqual([]);
  });

  it('lists files recursively by default', async () => {
    tmp.write('a.ts', '');
    tmp.write('nested/b.ts', '');
    tmp.write('nested/deep/c.ts', '');

    const files = await walk(tmp.path);

    expect(files.map((f) => path.relative(tmp.path, f)).sort()).toEqual(
      [path.join('nested', 'b.ts'), path.join('nested', 'deep', 'c.ts'), 'a.ts'].sort()
    );
  });

  it('does not recurse when recursive is false', async () => {
    tmp.write('a.ts', '');
    tmp.write('nested/b.ts', '');

    const files = await walk(tmp.path, { recursive: false });

    expect(files.map((f) => path.relative(tmp.path, f))).toEqual(['a.ts']);
  });

  it('applies the filter to returned files', async () => {
    tmp.write('a.ts', '');
    tmp.write('b.js', '');

    const files = await walk(tmp.path, { filter: (f) => f.endsWith('.ts') });

    expect(files.map((f) => path.relative(tmp.path, f))).toEqual(['a.ts']);
  });

  it('skips node_modules, dist and build by default', async () => {
    tmp.write('a.ts', '');
    tmp.write('node_modules/pkg/index.ts', '');
    tmp.write('dist/out.ts', '');
    tmp.write('build/out.ts', '');

    const files = await walk(tmp.path);

    expect(files.map((f) => path.relative(tmp.path, f))).toEqual(['a.ts']);
  });

  it('skips entries that are neither files nor directories (e.g. symlinks)', async () => {
    tmp.write('a.ts', '');

    fs.symlinkSync(path.join(tmp.path, 'a.ts'), path.join(tmp.path, 'link.ts'));

    const files = await walk(tmp.path);

    expect(files.map((f) => path.relative(tmp.path, f))).toEqual(['a.ts']);
  });

  it('honours a custom skipDirs predicate', async () => {
    tmp.write('a.ts', '');
    tmp.write('skip-me/b.ts', '');

    const files = await walk(tmp.path, { skipDirs: (name) => name === 'skip-me' });

    expect(files.map((f) => path.relative(tmp.path, f))).toEqual(['a.ts']);
  });
});
