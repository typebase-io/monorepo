import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SERVER_MARKER_FILE_NAME } from '#helpers/constants.ts';
import { getGeneratedServerDirPaths } from '#helpers/shared/get-generated-server-dir-paths.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const MARKER = JSON.stringify({
  adapter: 'node',
  mode: 'embedded',
  cliVersion: '1.2.3',
  dependencies: {},
  devDependencies: {},
  envKeys: [],
});

describe('getGeneratedServerDirPaths', () => {
  let tmp: TempDir;

  const resolve = (...segments: string[]) => path.join(tmp.path, ...segments);

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns the directory whose marker covers the source file', () => {
    tmp.write(`_handler/${SERVER_MARKER_FILE_NAME}`, MARKER);
    tmp.write('_handler/src/server.ts', 'export {};');

    expect(getGeneratedServerDirPaths(tmp.path, [resolve('_handler/src/server.ts')])).toEqual([resolve('_handler')]);
  });

  it('finds a marker nested several directories below the root', () => {
    tmp.write(`generated/embedded/${SERVER_MARKER_FILE_NAME}`, MARKER);
    tmp.write('generated/embedded/src/deep/server.ts', 'export {};');

    expect(getGeneratedServerDirPaths(tmp.path, [resolve('generated/embedded/src/deep/server.ts')])).toEqual([resolve('generated/embedded')]);
  });

  it('returns a generated directory once no matter how many of its files are checked', () => {
    tmp.write(`_handler/${SERVER_MARKER_FILE_NAME}`, MARKER);
    tmp.write('_handler/src/server.ts', 'export {};');
    tmp.write('_handler/src/env.ts', 'export {};');
    tmp.write('_handler/index.ts', 'export {};');

    expect(
      getGeneratedServerDirPaths(tmp.path, [resolve('_handler/src/server.ts'), resolve('_handler/src/env.ts'), resolve('_handler/index.ts')])
    ).toEqual([resolve('_handler')]);
  });

  it('returns every generated directory when output was written to more than one', () => {
    tmp.write(`first/${SERVER_MARKER_FILE_NAME}`, MARKER);
    tmp.write('first/src/server.ts', 'export {};');
    tmp.write(`second/${SERVER_MARKER_FILE_NAME}`, MARKER);
    tmp.write('second/src/server.ts', 'export {};');

    expect(getGeneratedServerDirPaths(tmp.path, [resolve('first/src/server.ts'), resolve('second/src/server.ts')]).toSorted()).toEqual([
      resolve('first'),
      resolve('second'),
    ]);
  });

  it('stops at the innermost marker when generated output nests inside generated output', () => {
    tmp.write(`outer/${SERVER_MARKER_FILE_NAME}`, MARKER);
    tmp.write(`outer/inner/${SERVER_MARKER_FILE_NAME}`, MARKER);
    tmp.write('outer/inner/src/server.ts', 'export {};');

    expect(getGeneratedServerDirPaths(tmp.path, [resolve('outer/inner/src/server.ts')])).toEqual([resolve('outer/inner')]);
  });

  it('returns nothing for source that no marker covers', () => {
    tmp.write('src/actions/todos.ts', 'export {};');

    expect(getGeneratedServerDirPaths(tmp.path, [resolve('src/actions/todos.ts')])).toEqual([]);
  });

  it.each([
    { name: 'malformed JSON', marker: 'not json at all' },
    { name: 'an empty object', marker: '{}' },
    { name: 'the wrong field types', marker: JSON.stringify({ ...JSON.parse(MARKER), envKeys: 'DATABASE_URL' }) },
  ])('ignores a marker with $name so real source keeps being checked', ({ marker }) => {
    tmp.write(`_handler/${SERVER_MARKER_FILE_NAME}`, marker);
    tmp.write('_handler/src/server.ts', 'export {};');

    expect(getGeneratedServerDirPaths(tmp.path, [resolve('_handler/src/server.ts')])).toEqual([]);
  });

  it('does not treat the root itself as generated output', () => {
    tmp.write(SERVER_MARKER_FILE_NAME, MARKER);
    tmp.write('server.ts', 'export {};');

    expect(getGeneratedServerDirPaths(tmp.path, [resolve('server.ts')])).toEqual([]);
  });

  it('does not escape the root to find a marker above it', () => {
    tmp.write(SERVER_MARKER_FILE_NAME, MARKER);
    tmp.write('typebase/actions/todos.ts', 'export {};');

    expect(getGeneratedServerDirPaths(resolve('typebase'), [resolve('typebase/actions/todos.ts')])).toEqual([]);
  });
});
