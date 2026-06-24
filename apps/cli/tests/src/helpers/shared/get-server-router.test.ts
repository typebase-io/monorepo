import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getServerRouter } from '#helpers/shared/get-server-router.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('getServerRouter', () => {
  let tmp: TempDir;

  const TS_CONFIG = JSON.stringify({
    compilerOptions: { strict: true, skipLibCheck: true, noEmit: true, target: 'ESNext' },
    include: ['./**/*.ts'],
  });

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('builds an importable router from action files, skipping non-actions', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', "export const hello = { '~orpc': {} as unknown };");
    tmp.write('actions/users/list.ts', "export const list = { '~orpc': {} as unknown };");
    tmp.write('actions/not-an-action.ts', 'export const value = 1;');

    const [imports, router] = await getServerRouter({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      outputFilePath: path.join(tmp.path, 'server.ts'),
      actionsOutputDirPath: path.join(tmp.path, 'actions'),
      generation: 'ts',
      exportable: true,
    });

    expect(imports).toEqualTemplate('get-server-router', 'multi-imports.txt');
    expect(router).toEqualTemplate('get-server-router', 'multi-router.txt');
  });

  it('emits .js import paths for esm/cjs generation', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/hello.ts', "export const hello = { '~orpc': {} as unknown };");

    const [imports, router] = await getServerRouter({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      outputFilePath: path.join(tmp.path, 'server.ts'),
      actionsOutputDirPath: path.join(tmp.path, 'actions'),
      generation: 'esm',
      exportable: true,
    });

    expect(imports).toEqualTemplate('get-server-router', 'esm-imports.txt');
    expect(router).toEqualTemplate('get-server-router', 'single-router.txt');
  });

  it('loads action files that are not part of the tsconfig include', async () => {
    tmp.write(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: { strict: true, skipLibCheck: true, noEmit: true, target: 'ESNext' },
        include: ['server.ts'],
      })
    );
    tmp.write('server.ts', 'export const placeholder = 1;');
    tmp.write('actions/hello.ts', "export const hello = { '~orpc': {} as unknown };");

    const [imports, router] = await getServerRouter({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      outputFilePath: path.join(tmp.path, 'server.ts'),
      actionsOutputDirPath: path.join(tmp.path, 'actions'),
      generation: 'ts',
      exportable: true,
    });

    expect(imports).toEqualTemplate('get-server-router', 'single-imports.txt');
    expect(router).toEqualTemplate('get-server-router', 'single-router.txt');
  });

  it('returns an empty, non-exported router when there are no actions', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('actions/not-an-action.ts', 'export const value = 1;');

    const [imports, router] = await getServerRouter({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      outputFilePath: path.join(tmp.path, 'server.ts'),
      actionsOutputDirPath: path.join(tmp.path, 'actions'),
      generation: 'ts',
      exportable: false,
    });

    expect(imports).toEqualTemplate('get-server-router', 'empty-imports.txt');
    expect(router).toEqualTemplate('get-server-router', 'empty-router.txt');
  });
});
