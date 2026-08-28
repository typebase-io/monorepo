import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readMigrations } from '#helpers/db/read-migrations.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const snapshotOf = (id: string, prevId: string) => JSON.stringify({ version: '8', dialect: 'postgres', id, prevIds: [prevId], ddl: [], renames: [] });

describe('readMigrations', () => {
  let tmp: TempDir;
  let migrationsDirPath: string;

  beforeEach(() => {
    tmp = createTempDir();
    migrationsDirPath = tmp.mkdir('migrations');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns an empty list for an empty migrations directory', async () => {
    expect(await readMigrations(migrationsDirPath)).toEqual([]);
  });

  it('returns an empty list when the migrations directory does not exist', async () => {
    expect(await readMigrations(path.join(tmp.path, 'nope'))).toEqual([]);
  });

  it('reads the snapshot carried by each migration', async () => {
    tmp.write('migrations/20260101000000_first/snapshot.json', snapshotOf('one', 'zero'));

    const migrations = await readMigrations(migrationsDirPath);

    expect(migrations).toHaveLength(1);
    expect(migrations[0]?.name).toBe('20260101000000_first');
    expect(migrations[0]?.snapshot.id).toBe('one');
  });

  it('returns migrations oldest first regardless of directory order', async () => {
    tmp.write('migrations/20260301000000_third/snapshot.json', snapshotOf('three', 'two'));
    tmp.write('migrations/20260101000000_first/snapshot.json', snapshotOf('one', 'zero'));
    tmp.write('migrations/20260201000000_second/snapshot.json', snapshotOf('two', 'one'));

    const migrations = await readMigrations(migrationsDirPath);

    expect(migrations.map((migration) => migration.snapshot.id)).toEqual(['one', 'two', 'three']);
  });

  it('ignores directories that carry no snapshot', async () => {
    tmp.write('migrations/20260101000000_first/snapshot.json', snapshotOf('one', 'zero'));
    tmp.write('migrations/20260201000000_sql_only/migration.sql', 'SELECT 1;');

    expect(await readMigrations(migrationsDirPath)).toHaveLength(1);
  });

  it('ignores loose files sitting next to the migration directories', async () => {
    tmp.write('migrations/20260101000000_first/snapshot.json', snapshotOf('one', 'zero'));
    tmp.write('migrations/README.md', 'not a migration');

    expect(await readMigrations(migrationsDirPath)).toHaveLength(1);
  });
});
