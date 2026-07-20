import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canReplaceServerDir } from '#helpers/generate-server/can-replace-server-dir.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('canReplaceServerDir', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('allows a path that does not exist', async () => {
    await expect(canReplaceServerDir(path.join(tmp.path, 'does-not-exist'))).resolves.toBe(true);
  });

  it('allows an empty directory', async () => {
    tmp.mkdir('empty');

    await expect(canReplaceServerDir(path.join(tmp.path, 'empty'))).resolves.toBe(true);
  });

  it('refuses a path that is a file', async () => {
    tmp.write('file.txt', 'content');

    await expect(canReplaceServerDir(path.join(tmp.path, 'file.txt'))).resolves.toBe(false);
  });

  it('allows a previously generated server directory', async () => {
    tmp.write('_server/package.json', JSON.stringify({ name: '@typebase-io/server' }));
    tmp.write('_server/src/index.ts', 'export {};');

    await expect(canReplaceServerDir(path.join(tmp.path, '_server'))).resolves.toBe(true);
  });

  it('refuses a non-empty directory without a package.json', async () => {
    tmp.write('desktop/notes.txt', 'do not delete');

    await expect(canReplaceServerDir(path.join(tmp.path, 'desktop'))).resolves.toBe(false);
  });

  it('refuses a non-empty directory whose package.json has a different name', async () => {
    tmp.write('app/package.json', JSON.stringify({ name: 'my-app' }));

    await expect(canReplaceServerDir(path.join(tmp.path, 'app'))).resolves.toBe(false);
  });

  it('refuses a non-empty directory whose package.json is invalid JSON', async () => {
    tmp.write('broken/package.json', '{ not json');

    await expect(canReplaceServerDir(path.join(tmp.path, 'broken'))).resolves.toBe(false);
  });
});
