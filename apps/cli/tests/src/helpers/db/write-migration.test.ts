import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type PostgresSnapshot } from '#helpers/db/read-migrations.ts';
import { writeMigration } from '#helpers/db/write-migration.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const snapshot = { version: '8', dialect: 'postgres', id: 'abc', prevIds: ['def'], ddl: [], renames: [] } as unknown as PostgresSnapshot;

describe('writeMigration', () => {
  let tmp: TempDir;
  let migrationsDirPath: string;

  const read = (dirPath: string, fileName: string) => fs.readFileSync(path.join(dirPath, fileName), 'utf8');

  beforeEach(() => {
    tmp = createTempDir();
    migrationsDirPath = tmp.mkdir('migrations');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T05:06:07.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    tmp.cleanup();
  });

  it('names the directory after the current UTC timestamp', async () => {
    const { name } = await writeMigration({ migrationsDirPath, name: undefined, sqlStatements: ['SELECT 1;'], snapshot });

    expect(name).toBe('20260304050607');
    expect(fs.existsSync(path.join(migrationsDirPath, '20260304050607'))).toBe(true);
  });

  it('appends the given name to the timestamp', async () => {
    const { name } = await writeMigration({ migrationsDirPath, name: 'add todos', sqlStatements: ['SELECT 1;'], snapshot });

    expect(name).toBe('20260304050607_add_todos');
  });

  it('writes the sql and the snapshot into the directory', async () => {
    const { dirPath } = await writeMigration({ migrationsDirPath, name: undefined, sqlStatements: ['CREATE TABLE "todos";'], snapshot });

    expect(read(dirPath, 'migration.sql')).toEqualTemplate('write-migration', 'migration.sql.txt');
    expect(read(dirPath, 'snapshot.json')).toEqualTemplate('write-migration', 'snapshot.json.txt');
  });

  it('separates statements with the breakpoint drizzle splits on', async () => {
    const { dirPath } = await writeMigration({
      migrationsDirPath,
      name: undefined,
      sqlStatements: ['CREATE TABLE "a";', 'CREATE TABLE "b";'],
      snapshot,
    });

    expect(read(dirPath, 'migration.sql')).toEqualTemplate('write-migration', 'two-statements.sql.txt');
  });

  it('separates statements with something postgres reads as a comment', async () => {
    const { dirPath } = await writeMigration({
      migrationsDirPath,
      name: undefined,
      sqlStatements: ['CREATE TABLE "a";', 'CREATE TABLE "b";'],
      snapshot,
    });

    const separators = read(dirPath, 'migration.sql')
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('CREATE'));

    expect(separators.every((line) => line.startsWith('--'))).toBe(true);
  });

  it('creates the migrations directory when it does not exist yet', async () => {
    const nested = path.join(tmp.path, 'db', 'migrations');

    const { dirPath } = await writeMigration({ migrationsDirPath: nested, name: undefined, sqlStatements: ['SELECT 1;'], snapshot });

    expect(read(dirPath, 'migration.sql')).toEqualTemplate('write-migration', 'first-statement.sql.txt');
  });

  it('writes an empty statement list as an empty sql file', async () => {
    const { dirPath } = await writeMigration({ migrationsDirPath, name: undefined, sqlStatements: [], snapshot });

    expect(read(dirPath, 'migration.sql')).toEqualTemplate('write-migration', 'empty.sql.txt');
  });

  it('sorts chronologically against a migration written a second earlier', async () => {
    const { name: first } = await writeMigration({ migrationsDirPath, name: 'first', sqlStatements: ['SELECT 1;'], snapshot });

    vi.setSystemTime(new Date('2026-03-04T05:06:08.000Z'));

    const { name: second } = await writeMigration({ migrationsDirPath, name: 'second', sqlStatements: ['SELECT 2;'], snapshot });

    expect([second, first].sort((a, b) => a.localeCompare(b))).toEqual([first, second]);
  });

  it('keeps name order equal to creation order when names sort the other way', async () => {
    const first = await writeMigration({ migrationsDirPath, name: 'first', sqlStatements: ['SELECT 1;'], snapshot });
    const second = await writeMigration({ migrationsDirPath, name: 'add priority', sqlStatements: ['SELECT 2;'], snapshot });

    expect([second.name, first.name].sort((a, b) => a.localeCompare(b))).toEqual([first.name, second.name]);
  });

  it('does not overwrite a migration recorded in the same second', async () => {
    const first = await writeMigration({ migrationsDirPath, name: undefined, sqlStatements: ['SELECT 1;'], snapshot });
    const second = await writeMigration({ migrationsDirPath, name: undefined, sqlStatements: ['SELECT 2;'], snapshot });

    expect(second.name).not.toBe(first.name);
    expect(read(first.dirPath, 'migration.sql')).toEqualTemplate('write-migration', 'first-statement.sql.txt');
    expect(read(second.dirPath, 'migration.sql')).toEqualTemplate('write-migration', 'second-statement.sql.txt');
    expect([second.name, first.name].sort((a, b) => a.localeCompare(b))).toEqual([first.name, second.name]);
  });

  it.each([
    ['Add Todos', '20260304050607_add_todos'],
    ['  spaced   out  ', '20260304050607_spaced_out'],
    ['weird!!name', '20260304050607_weird_name'],
    ['already_snake', '20260304050607_already_snake'],
  ])('slugifies %s into the directory name', async (given, expected) => {
    const { name } = await writeMigration({ migrationsDirPath, name: given, sqlStatements: ['SELECT 1;'], snapshot });

    expect(name).toBe(expected);
  });
});
