import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, test } from 'vitest';

import { generateAction } from '#helpers/generate-server/generate-action.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateAction', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('creates the output directory tree even when it does not exist yet', async () => {
    const serverOutputDirPath = path.join(tmp.path, 'does', 'not', 'exist', 'src');

    await generateAction({ serverOutputDirPath, hasDB: true, hasAuth: true, hasEnv: false });

    expect(fs.statSync(serverOutputDirPath).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(serverOutputDirPath, 'server.ts'))).toBe(true);
  });

  test('when nothing is present', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: false, hasAuth: false, hasEnv: false });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'none.txt');
  });

  test('when only db is present', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: true, hasAuth: false, hasEnv: false });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'only-db.txt');
  });

  test('when only auth is present', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: false, hasAuth: true, hasEnv: false });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'only-auth.txt');
  });

  test('when only env is present', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: false, hasAuth: false, hasEnv: true });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'only-env.txt');
  });

  test('when db and auth are present', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: true, hasAuth: true, hasEnv: false });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'db-and-auth.txt');
  });

  test('when db and env are present', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: true, hasAuth: false, hasEnv: true });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'db-and-env.txt');
  });

  test('when auth and env are present', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: false, hasAuth: true, hasEnv: true });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'auth-and-env.txt');
  });

  test('when everything is present', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: true, hasAuth: true, hasEnv: true });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'all.txt');
  });
});
