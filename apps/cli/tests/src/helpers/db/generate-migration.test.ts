import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateMigration } from '#helpers/db/generate-migration.ts';
import { readMigrationFiles } from '#helpers/db/read-migration-files.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const withPriorityColumn = `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),
  priority: p.integer(),
});
`;

describe('generateMigration', () => {
  let tmp: TempDir;
  let dbDirPath: string;
  let migrationsDirPath: string;

  const generate = (name?: string) => withCwd(tmp.path, () => generateMigration({ dbDirPath, migrationsDirPath, serverProvider: 'vercel', name }));

  const readSql = (dirPath: string | undefined) => fs.readFileSync(path.join(dirPath ?? '', 'migration.sql'), 'utf8');

  beforeEach(async () => {
    tmp = createTempDir();

    linkTypebaseIo(tmp);

    const projectDir = await generateTypebaseProject(tmp, { withAuth: false });

    dbDirPath = path.join(projectDir, 'db');
    migrationsDirPath = tmp.mkdir('typebase/db/migrations');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns where it wrote the migration', async () => {
    const migration = await generate('first');

    expect(migration?.name).toMatch(/^\d{14}_first$/);
    expect(fs.existsSync(path.join(migration?.dirPath ?? '', 'snapshot.json'))).toBe(true);
  });

  it('writes creation sql for the whole schema when there is no prior migration', async () => {
    const migration = await generate('first');

    expect(readSql(migration?.dirPath)).toEqualTemplate('generate-migration', 'initial.sql.txt');
  });

  it('writes only the change when diffing against the last snapshot', async () => {
    await generate('first');

    tmp.write('typebase/db/schema.ts', withPriorityColumn);

    const migration = await generate('second');

    expect(readSql(migration?.dirPath)).toEqualTemplate('generate-migration', 'add-column.sql.txt');
  });

  it('separates every statement of a multi-statement migration', async () => {
    await generateTypebaseProject(tmp, { withAuth: false, withPublisher: true });

    const migration = await generate('first');

    expect(readSql(migration?.dirPath)).toEqualTemplate('generate-migration', 'initial-with-publisher.sql.txt');
  });

  it('returns undefined and writes nothing when the schema matches the last snapshot', async () => {
    await generate('first');

    expect(await generate('second')).toBeUndefined();
    expect(fs.readdirSync(migrationsDirPath)).toHaveLength(1);
  });

  it('records a migration even with nothing to apply when allowEmpty is set', async () => {
    await generate('first');

    const migration = await withCwd(tmp.path, () =>
      generateMigration({ dbDirPath, migrationsDirPath, serverProvider: 'vercel', name: 'second', allowEmpty: true })
    );

    expect(migration.name).toMatch(/_second$/);
    expect(fs.readdirSync(migrationsDirPath)).toHaveLength(2);
  });

  it('records the snapshot alone when there is nothing to apply, so the migrator skips it', async () => {
    await generate('first');

    const migration = await withCwd(tmp.path, () =>
      generateMigration({ dbDirPath, migrationsDirPath, serverProvider: 'vercel', name: 'second', allowEmpty: true })
    );

    expect(fs.readdirSync(migration.dirPath)).toEqual(['snapshot.json']);
    expect(readMigrationFiles(migrationsDirPath).map(({ name }) => name)).toEqual([expect.stringMatching(/_first$/)]);
  });

  it('still writes the sql file when there is something to apply', async () => {
    const migration = await generate('first');

    expect(fs.readdirSync(migration?.dirPath ?? '').sort()).toEqual(['migration.sql', 'snapshot.json']);
  });

  it('records the schema it actually built, not an assumed empty one, when allowEmpty is set', async () => {
    const migration = await withCwd(tmp.path, () =>
      generateMigration({ dbDirPath, migrationsDirPath, serverProvider: 'vercel', name: 'first', allowEmpty: true })
    );

    const snapshot = JSON.parse(fs.readFileSync(path.join(migration.dirPath, 'snapshot.json'), 'utf8')) as { ddl: unknown[] };

    expect(snapshot.ddl.length).toBeGreaterThan(0);
  });

  it('leaves no temporary build directory behind', async () => {
    await generate('first');

    expect(fs.readdirSync(path.join(tmp.path, 'typebase', 'db'))).toEqual(expect.arrayContaining(['migrations', 'schema.ts']));
  });

  it('fails when the schema cannot be built', async () => {
    tmp.write('typebase/db/schema.ts', 'export const broken = (');

    await expect(generate('first')).rejects.toThrow('The generated server contains syntax errors');
    expect(fs.readdirSync(migrationsDirPath)).toHaveLength(0);
  });
});
