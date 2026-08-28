import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateCustomMigration } from '#helpers/db/generate-custom-migration.ts';
import { generateMigration } from '#helpers/db/generate-migration.ts';

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

const withoutIds = (contents: string) =>
  contents.replaceAll(/(?!00000000-0000-0000-0000-000000000000)[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/g, '<uuid>');

describe('generateCustomMigration', () => {
  let tmp: TempDir;
  let dbDirPath: string;
  let migrationsDirPath: string;

  const custom = (name?: string) => withCwd(tmp.path, () => generateCustomMigration({ migrationsDirPath, name }));

  const generate = (name?: string) => withCwd(tmp.path, () => generateMigration({ dbDirPath, migrationsDirPath, serverProvider: 'vercel', name }));

  const read = (dirPath: string | undefined, fileName: string) => fs.readFileSync(path.join(dirPath ?? '', fileName), 'utf8');

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

  it('writes a migration directory holding an empty sql file', async () => {
    const { dirPath } = await custom('backfill todos');

    expect(read(dirPath, 'migration.sql')).toEqualTemplate('generate-custom-migration', 'empty.sql.txt');
  });

  it('names the directory after the given name', async () => {
    const { name } = await custom('backfill todos');

    expect(name).toMatch(/^\d{14}_backfill_todos$/);
  });

  it('copies the previous snapshot verbatim, so it records no schema change', async () => {
    const first = await generate('first');

    const { dirPath } = await custom('backfill todos');

    expect(read(dirPath, 'snapshot.json')).toBe(read(first?.dirPath, 'snapshot.json'));
  });

  it('leaves a schema edit made beforehand unrecorded', async () => {
    await generate('first');

    tmp.write('typebase/db/schema.ts', withPriorityColumn);

    const { dirPath } = await custom('backfill todos');

    expect(withoutIds(read(dirPath, 'snapshot.json'))).toEqualTemplate('generate-custom-migration', 'copied-snapshot.json.txt');
  });

  it('still generates the skipped schema edit on the next ordinary generate', async () => {
    await generate('first');

    tmp.write('typebase/db/schema.ts', withPriorityColumn);

    await custom('backfill todos');

    const next = await generate('add priority');

    expect(read(next?.dirPath, 'migration.sql')).toEqualTemplate('generate-custom-migration', 'add-column.sql.txt');
  });

  it('records an empty schema when there is no previous migration to copy', async () => {
    const { dirPath } = await custom('create extension');

    expect(withoutIds(read(dirPath, 'snapshot.json'))).toEqualTemplate('generate-custom-migration', 'empty-snapshot.json.txt');
  });

  it('leaves the whole schema to be created by the generate that follows it', async () => {
    await custom('create extension');

    const next = await generate('initial');

    expect(read(next?.dirPath, 'migration.sql')).toEqualTemplate('generate-custom-migration', 'initial.sql.txt');
  });
});
