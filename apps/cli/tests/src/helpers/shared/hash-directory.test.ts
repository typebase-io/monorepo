import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hashDirectory } from '#helpers/shared/hash-directory.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('hashDirectory', () => {
  let tmp: TempDir;

  const dirPath = () => path.join(tmp.path, 'db');

  const hash = () => hashDirectory(dirPath());

  beforeEach(() => {
    tmp = createTempDir();

    tmp.write('db/schema.ts', 'export const todos = {};\n');
    tmp.write('db/relations.ts', 'export const relations = {};\n');
    tmp.write('db/migrations/0000_initial/migration.sql', 'CREATE TABLE todos ();\n');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('hashes a directory the same way every time nothing in it changes', async () => {
    await expect(hash()).resolves.toBe(await hash());
  });

  it('hashes a directory differently once a file in it changes', async () => {
    const before = await hash();

    tmp.write('db/schema.ts', 'export const todos = { priority: true };\n');

    await expect(hash()).resolves.not.toBe(before);
  });

  it('hashes a directory differently once a file deep inside it changes', async () => {
    const before = await hash();

    tmp.write('db/migrations/0000_initial/migration.sql', 'CREATE TABLE todos (id int);\n');

    await expect(hash()).resolves.not.toBe(before);
  });

  it('hashes a directory differently once a file is added to it', async () => {
    const before = await hash();

    tmp.write('db/seed.ts', 'export const seed = [];\n');

    await expect(hash()).resolves.not.toBe(before);
  });

  it('hashes a directory differently once a file is removed from it', async () => {
    const before = await hash();

    fs.rmSync(path.join(dirPath(), 'relations.ts'));

    await expect(hash()).resolves.not.toBe(before);
  });

  it('hashes a directory differently once a file is renamed, contents unchanged', async () => {
    const before = await hash();

    fs.renameSync(path.join(dirPath(), 'schema.ts'), path.join(dirPath(), 'tables.ts'));

    await expect(hash()).resolves.not.toBe(before);
  });

  it('ignores installed dependencies', async () => {
    const before = await hash();

    tmp.write('db/node_modules/left-over/index.js', 'module.exports = {};\n');

    await expect(hash()).resolves.toBe(before);
  });

  it('hashes nothing for a directory that does not exist', async () => {
    await expect(hashDirectory(path.join(tmp.path, 'nowhere'))).resolves.toBe('');
  });
});
