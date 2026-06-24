import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

    await generateAction({ serverOutputDirPath, hasDB: true, hasAuth: true });

    expect(fs.statSync(serverOutputDirPath).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(serverOutputDirPath, 'server.ts'))).toBe(true);
  });

  it('writes the server template with db and auth', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: true, hasAuth: true });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'with-db-auth.txt');
  });

  it('writes the server template with db but without auth', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: true, hasAuth: false });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'db-only.txt');
  });

  it('writes the server template with auth but without db', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: false, hasAuth: true });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'auth-only.txt');
  });

  it('writes the server template without db and auth', async () => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB: false, hasAuth: false });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', 'without-db-auth.txt');
  });
});
