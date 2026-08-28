import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectDrift } from '#helpers/db/detect-drift.ts';
import { generateMigration } from '#helpers/db/generate-migration.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const todos = `  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),`;

const todosTable = (columns = todos) => `export const todos = p.pgTable("todos", {\n${columns}\n});`;

const notesTable = `export const notes = p.pgTable("notes", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  body: p.text().notNull(),
});`;

describe('detectDrift', () => {
  let tmp: TempDir;
  let dbDirPath: string;
  let migrationsDirPath: string;

  const detect = () => withCwd(tmp.path, () => detectDrift({ dbDirPath, migrationsDirPath, serverProvider: 'vercel' }));

  const recordCurrentSchema = () =>
    withCwd(tmp.path, () => generateMigration({ dbDirPath, migrationsDirPath, serverProvider: 'vercel', name: 'recorded' }));

  const writeSchema = (body: string) => {
    tmp.write('typebase/db/schema.ts', `import { p } from "typebase-io/db";\n\n${body}\n`);
  };

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

  it('reports no drift when every change is recorded', async () => {
    await recordCurrentSchema();

    expect(await detect()).toEqual({ tables: [] });
  });

  it('reports every table when nothing has been recorded yet', async () => {
    writeSchema(`${todosTable()}\n\n${notesTable}`);

    expect(await detect()).toEqual({ tables: ['notes', 'todos'] });
  });

  it('reports a table that was added since the last migration', async () => {
    await recordCurrentSchema();

    writeSchema(`${todosTable()}\n\n${notesTable}`);

    expect(await detect()).toEqual({ tables: ['notes'] });
  });

  it('reports a table that was removed since the last migration', async () => {
    writeSchema(`${todosTable()}\n\n${notesTable}`);

    await recordCurrentSchema();

    writeSchema(todosTable());

    expect(await detect()).toEqual({ tables: ['notes'] });
  });

  it('reports a table whose column was added', async () => {
    await recordCurrentSchema();

    writeSchema(todosTable(`${todos}\n  priority: p.integer(),`));

    expect(await detect()).toEqual({ tables: ['todos'] });
  });

  it('reports a table whose column changed type', async () => {
    await recordCurrentSchema();

    writeSchema(todosTable(todos.replace('p.varchar({ length: 255 }).notNull()', 'p.text().notNull()')));

    expect(await detect()).toEqual({ tables: ['todos'] });
  });

  it('reports a table whose column stopped being required', async () => {
    await recordCurrentSchema();

    writeSchema(todosTable(todos.replace('completed: p.boolean().notNull(),', 'completed: p.boolean(),')));

    expect(await detect()).toEqual({ tables: ['todos'] });
  });

  it('reports every affected table when more than one drifted', async () => {
    writeSchema(`${todosTable()}\n\n${notesTable}`);

    await recordCurrentSchema();

    writeSchema(`${todosTable(`${todos}\n  priority: p.integer(),`)}\n\n${notesTable.replace('body: p.text().notNull(),', 'body: p.text(),')}`);

    expect(await detect()).toEqual({ tables: ['notes', 'todos'] });
  });

  it('reports a table added inside a non-public schema', async () => {
    await recordCurrentSchema();

    writeSchema(`export const analytics = p.pgSchema("analytics");

${todosTable()}

export const visits = analytics.table("visits", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  path: p.text().notNull(),
});`);

    expect(await detect()).toEqual({ tables: ['analytics', 'visits'] });
  });

  it('reports a non-public schema that was removed', async () => {
    writeSchema(`export const analytics = p.pgSchema("analytics");

${todosTable()}

export const visits = analytics.table("visits", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  path: p.text().notNull(),
});`);

    await recordCurrentSchema();

    writeSchema(todosTable());

    expect(await detect()).toEqual({ tables: ['analytics', 'visits'] });
  });

  it('opens no database connection', async () => {
    await recordCurrentSchema();

    writeSchema(todosTable(`${todos}\n  priority: p.integer(),`));

    expect(await detect()).toEqual({ tables: ['todos'] });
  });
});
