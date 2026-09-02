import fs from 'node:fs';
import path from 'node:path';

import { confirm, input, select } from '@inquirer/prompts';
import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '#commands/db.ts';

import { applyMigrations } from '#helpers/db/apply-migrations.ts';
import { markMigrationApplied } from '#helpers/db/mark-migration-applied.ts';
import { findNeonTarget } from '#helpers/db/neon/find-neon-target.ts';
import { neon } from '#helpers/db/neon/index.ts';
import { pullSchema } from '#helpers/db/pull-schema.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';
import { readMigrationFiles } from '#helpers/db/read-migration-files.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { readPulledSource } from '#tests/helpers/read-pulled-source.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/db/apply-migrations.ts', () => ({ applyMigrations: vi.fn() }));
vi.mock('#helpers/db/mark-migration-applied.ts', () => ({ markMigrationApplied: vi.fn() }));
vi.mock('#helpers/db/neon/find-neon-target.ts', () => ({ findNeonTarget: vi.fn() }));
vi.mock('#helpers/db/neon/index.ts', () => ({ neon: vi.fn() }));
vi.mock('#helpers/db/push-schema.ts', () => ({ pushSchema: vi.fn() }));
vi.mock('#helpers/db/pull-schema.ts', () => ({ pullSchema: vi.fn() }));

// eslint-disable-next-line no-control-regex
const stripColours = (line: string) => line.replaceAll(/\u001B\[\d+(?:;\d+)*m/g, '');

const readLog = () =>
  `${vi
    .mocked(console.log)
    .mock.calls.map(([line]) => stripColours(String(line)))
    .join('\n')
    .trim()}\n`;

const succeeded = () =>
  vi
    .mocked(ora())
    .succeed.mock.calls.flat()
    .map((line) => stripColours(String(line)))
    .join('\n');

const asked = () =>
  vi
    .mocked(confirm)
    .mock.calls.map(([{ message }]) => message)
    .join('\n');

const warned = () =>
  vi
    .mocked(ora())
    .warn.mock.calls.flat()
    .map((line) => stripColours(String(line)))
    .join('\n');

describe('db command', () => {
  let tmp: TempDir;
  let builtSchemaExistedAtPush: boolean;

  beforeEach(async () => {
    vi.clearAllMocks();

    delete process.env.DATABASE_URL;

    tmp = createTempDir();

    linkTypebaseIo(tmp);

    await generateTypebaseProject(tmp);

    builtSchemaExistedAtPush = false;

    vi.mocked(neon).mockResolvedValue({
      projectId: 'proj-1',
      branchId: 'br-1',
      connectionUri: 'postgres://neon/db',
    });

    vi.mocked(pushSchema).mockImplementation(({ serverDistDirPath }) => {
      builtSchemaExistedAtPush = fs.existsSync(path.join(serverDistDirPath, 'src', 'db', 'schema.js'));

      return Promise.resolve({ sqlStatements: [] });
    });

    vi.mocked(applyMigrations).mockResolvedValue({ applied: [] });
    vi.mocked(markMigrationApplied).mockResolvedValue({ marked: true });
    vi.mocked(findNeonTarget).mockResolvedValue({ connectionUri: 'postgres://neon/db' });

    vi.mocked(pullSchema).mockResolvedValue({
      schema: readPulledSource('schema.ts.txt'),
      relations: readPulledSource('relations.ts.txt'),
    });

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;

    delete process.env.DATABASE_URL;

    vi.restoreAllMocks();
  });

  describe('dev / prod push', () => {
    it('builds the schema and pushes it to the neon dev branch', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      await withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }));

      expect(select).not.toHaveBeenCalled();
      expect(neon).toHaveBeenCalledWith({ target: 'dev' });
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://neon/db' }));
      expect(builtSchemaExistedAtPush).toBe(true);
    });

    it('targets the prod branch for the prod subcommand', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'deno' }));

      await withCwd(tmp.path, () => db.parseAsync(['prod', 'push'], { from: 'user' }));

      expect(neon).toHaveBeenCalledWith({ target: 'prod' });
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://neon/db' }));
    });

    it('does not modify the configured provider', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      await withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }));

      expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ serverProvider: 'vercel' });
    });

    it('prompts for the provider and persists it to typebase.json when none is configured', async () => {
      vi.mocked(select).mockResolvedValue('cloudflare');

      await withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }));

      expect(select).toHaveBeenCalledOnce();
      expect(tmp.exists('typebase.json')).toBe(true);
      expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ serverProvider: 'cloudflare' });
      expect(neon).toHaveBeenCalledWith({ target: 'dev' });
    });

    it('throws and never contacts neon when there is no database schema', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }))).rejects.toThrow(
        'No database schema found. Create a schema file at db/schema.ts.'
      );

      expect(neon).not.toHaveBeenCalled();
      expect(pushSchema).not.toHaveBeenCalled();
    });

    it('asks about destructive changes by default', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      await withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ skipConfirmation: false }));
    });

    it('passes --skip-confirmation through', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      await withCwd(tmp.path, () => db.parseAsync(['dev', 'push', '--skip-confirmation'], { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ skipConfirmation: true }));
    });

    it('propagates a failure from pushSchema', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      vi.mocked(pushSchema).mockRejectedValueOnce(new Error('db unreachable'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }))).rejects.toThrow('db unreachable');
    });
  });

  describe('local push', () => {
    it('builds and pushes using the --url flag without contacting neon', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['local', 'push', '--url', 'postgres://local/db'], { from: 'user' }));

      expect(select).not.toHaveBeenCalled();
      expect(neon).not.toHaveBeenCalled();
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://local/db' }));
      expect(builtSchemaExistedAtPush).toBe(true);
    });

    it('falls back to DATABASE_URL from the environment', async () => {
      process.env.DATABASE_URL = 'postgres://env/db';

      await withCwd(tmp.path, () => db.parseAsync(['local', 'push'], { from: 'user' }));

      expect(neon).not.toHaveBeenCalled();
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://env/db' }));
    });

    it('reads DATABASE_URL from the .env file', async () => {
      tmp.write('.env', 'DATABASE_URL=postgres://file/db\n');

      await withCwd(tmp.path, () => db.parseAsync(['local', 'push'], { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://file/db' }));
    });

    it.each(['vercel', 'deno', 'cloudflare'] as const)(
      'builds the schema with the %s adapter when that provider is configured',
      async (serverProvider) => {
        tmp.write('typebase.json', JSON.stringify({ serverProvider }));

        await withCwd(tmp.path, () => db.parseAsync(['local', 'push', '--url', 'postgres://local/db'], { from: 'user' }));

        expect(select).not.toHaveBeenCalled();
        expect(neon).not.toHaveBeenCalled();
        expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://local/db' }));
        expect(builtSchemaExistedAtPush).toBe(true);
      }
    );

    it('asks about destructive changes by default', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['local', 'push', '--url', 'postgres://local/db'], { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ skipConfirmation: false }));
    });

    it('passes --skip-confirmation through', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['local', 'push', '--url', 'postgres://local/db', '--skip-confirmation'], { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ skipConfirmation: true }));
    });

    it('throws when no database url can be resolved', async () => {
      await expect(withCwd(tmp.path, () => db.parseAsync(['local', 'push'], { from: 'user' }))).rejects.toThrow(
        'No database URL provided. Pass --url or set DATABASE_URL.'
      );

      expect(pushSchema).not.toHaveBeenCalled();
    });

    it('throws when there is no database schema', async () => {
      fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['local', 'push', '--url', 'postgres://local/db'], { from: 'user' }))).rejects.toThrow(
        'No database schema found. Create a schema file at db/schema.ts.'
      );

      expect(pushSchema).not.toHaveBeenCalled();
    });
  });

  describe('migrations', () => {
    const useSchemaWithoutAuth = async () => await generateTypebaseProject(tmp, { withAuth: false });

    const generate = (...args: string[]) => withCwd(tmp.path, () => db.parseAsync(['migrations', 'generate', ...args], { from: 'user' }));

    const migrationNames = () => fs.readdirSync(path.join(tmp.path, 'typebase/db/migrations')).sort((a, b) => a.localeCompare(b));

    const readMigrationSql = (name: string) => fs.readFileSync(path.join(tmp.path, 'typebase/db/migrations', name, 'migration.sql'), 'utf8');

    const readSnapshotFile = (name: string) => fs.readFileSync(path.join(tmp.path, 'typebase/db/migrations', name, 'snapshot.json'), 'utf8');

    const readSnapshot = (name: string) => JSON.parse(readSnapshotFile(name)) as { id: string; prevIds: string[]; ddl: unknown[] };

    /** Every snapshot carries a fresh uuid. The origin id is fixed and meaningful, so it stays. */
    const withoutIds = (contents: string) =>
      contents.replaceAll(/(?!00000000-0000-0000-0000-000000000000)[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/g, '<uuid>');

    beforeEach(async () => {
      await useSchemaWithoutAuth();

      tmp.mkdir('typebase/db/migrations');
    });

    describe('generate', () => {
      it('writes a timestamped directory holding the sql and the snapshot', async () => {
        await generate();

        const [name = ''] = migrationNames();

        expect(name).toMatch(/^\d{14}$/);
        expect(readMigrationSql(name)).toEqualTemplate('db-migrations', 'initial.sql.txt');
        expect(withoutIds(readSnapshotFile(name))).toEqualTemplate('db-migrations', 'initial-snapshot.json.txt');
      });

      it('reflects --name in the directory name', async () => {
        await generate('--name', 'add todos');

        expect(migrationNames()).toEqual([expect.stringMatching(/^\d{14}_add_todos$/)]);
      });

      it('opens no database connection', async () => {
        await generate();

        expect(neon).not.toHaveBeenCalled();
        expect(pushSchema).not.toHaveBeenCalled();
      });

      it('produces creation sql for the whole schema, named the way push names columns', async () => {
        await generate();

        const [name = ''] = migrationNames();

        expect(readMigrationSql(name)).toEqualTemplate('db-migrations', 'initial.sql.txt');
      });

      it('explains what to do with the migration it wrote', async () => {
        await generate();

        expect(readLog()).toContain('npx typebase-io-cli db dev migrate');
      });

      it('reports the migration it wrote', async () => {
        await generate('--name', 'add todos');

        expect(succeeded()).toMatch(/Migration written to .*20\d{12}_add_todos\./);
      });

      it('diffs against the most recent snapshot so a second migration holds only the change', async () => {
        await generate('--name', 'first');

        tmp.write(
          'typebase/db/schema.ts',
          `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),
  priority: p.integer(),
});
`
        );

        await generate('--name', 'add priority');

        const [, second = ''] = migrationNames();

        expect(readMigrationSql(second)).toEqualTemplate('db-migrations', 'add-column.sql.txt');
      });

      it('chains each snapshot to the one before it', async () => {
        await generate('--name', 'first');

        tmp.write(
          'typebase/db/schema.ts',
          `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
});
`
        );

        await generate('--name', 'second');

        const [first = '', second = ''] = migrationNames();

        expect(readSnapshot(second).prevIds).toEqual([readSnapshot(first).id]);
      });

      it('names migrations so they sort chronologically', async () => {
        await generate('--name', 'first');

        tmp.write(
          'typebase/db/schema.ts',
          `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", { id: p.integer().primaryKey().generatedAlwaysAsIdentity() });
`
        );

        await generate('--name', 'second');

        const names = migrationNames();

        expect(names).toHaveLength(2);
        expect(names[0]).toMatch(/_first$/);
        expect(names[1]).toMatch(/_second$/);
      });

      it('writes nothing and reports being up to date when the schema has not changed', async () => {
        await generate('--name', 'first');
        await generate('--name', 'second');

        expect(migrationNames()).toHaveLength(1);
        expect(succeeded()).toContain('Schema is up to date. No migration written.');
      });

      it('throws when the project has no schema', async () => {
        fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

        await expect(generate()).rejects.toThrow('No database schema found. Create a schema file at db/schema.ts.');
      });

      it('throws when the project is not in migrations mode', async () => {
        fs.rmSync(path.join(tmp.path, 'typebase/db/migrations'), { recursive: true });

        await expect(generate()).rejects.toThrow('This project does not use migrations');
      });
    });

    describe('generate with a forked history', () => {
      const schemaWith = (columns: string) => `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),
  ${columns}
});
`;

      const fork = async () => {
        await generate('--name', 'first');

        tmp.write('typebase/db/schema.ts', schemaWith('priority: p.integer(),'));

        await generate('--name', 'add priority');

        const migrationsRoot = path.join(tmp.path, 'typebase/db/migrations');
        const [, second = ''] = migrationNames();
        const stashed = path.join(tmp.path, 'stashed-migration');

        fs.renameSync(path.join(migrationsRoot, second), stashed);

        tmp.write('typebase/db/schema.ts', schemaWith('status: p.text(),'));

        await generate('--name', 'add status');

        fs.renameSync(stashed, path.join(migrationsRoot, second));
      };

      it('refuses to generate and names the competing migrations', async () => {
        await fork();

        const failure = generate('--name', 'next');

        await expect(failure).rejects.toThrow('Your migration history has forked');
        await expect(failure).rejects.toThrow('add_priority');
        await expect(failure).rejects.toThrow('add_status');
      });

      it('writes nothing when it refuses', async () => {
        await fork();

        const before = migrationNames();

        await expect(generate('--name', 'next')).rejects.toThrow('forked');

        expect(migrationNames()).toEqual(before);
      });

      it('refuses a custom migration too', async () => {
        await fork();

        await expect(generate('--custom', '--name', 'backfill')).rejects.toThrow('Your migration history has forked');
      });

      it('generates anyway with --ignore-conflicts', async () => {
        await fork();

        const before = migrationNames().length;

        tmp.write('typebase/db/schema.ts', schemaWith('status: p.text(),\n  priority: p.integer(),'));

        await generate('--name', 'merge', '--ignore-conflicts');

        expect(migrationNames()).toHaveLength(before + 1);
      });

      it('records a custom migration with --ignore-conflicts', async () => {
        await fork();

        const before = migrationNames().length;

        await generate('--custom', '--name', 'backfill', '--ignore-conflicts');

        expect(migrationNames()).toHaveLength(before + 1);
      });

      it('leaves a healthy linear history alone', async () => {
        await generate('--name', 'first');

        tmp.write('typebase/db/schema.ts', schemaWith('priority: p.integer(),'));

        await generate('--name', 'add priority');

        tmp.write('typebase/db/schema.ts', schemaWith('priority: p.integer(),\n  status: p.text(),'));

        await generate('--name', 'add status');

        expect(migrationNames()).toHaveLength(3);
      });
    });

    describe('generate --custom', () => {
      const readSql = (name: string) => fs.readFileSync(path.join(tmp.path, 'typebase/db/migrations', name, 'migration.sql'), 'utf8');

      it('creates a migration directory holding an empty sql file', async () => {
        await generate('--custom', '--name', 'backfill todos');

        const [name = ''] = migrationNames();

        expect(name).toMatch(/^\d{14}_backfill_todos$/);
        expect(readSql(name)).toEqualTemplate('db-migrations', 'custom-empty.sql.txt');
      });

      it('copies the previous snapshot verbatim', async () => {
        await generate('--name', 'first');
        await generate('--custom', '--name', 'backfill todos');

        const [first = '', second = ''] = migrationNames();

        expect(readSnapshot(second)).toEqual(readSnapshot(first));
      });

      it('does not absorb a schema edit made beforehand', async () => {
        await generate('--name', 'first');

        tmp.write(
          'typebase/db/schema.ts',
          `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),
  priority: p.integer(),
});
`
        );

        await generate('--custom', '--name', 'backfill todos');
        await generate('--name', 'add priority');

        const [, , third = ''] = migrationNames();

        expect(readSql(third)).toEqualTemplate('db-migrations', 'add-column.sql.txt');
      });

      it('opens no database connection', async () => {
        await generate('--custom', '--name', 'backfill todos');

        expect(neon).not.toHaveBeenCalled();
        expect(applyMigrations).not.toHaveBeenCalled();
      });

      it('records an empty schema when there is no previous migration', async () => {
        await generate('--custom', '--name', 'create extension');

        const [name = ''] = migrationNames();

        expect(withoutIds(readSnapshotFile(name))).toEqualTemplate('db-migrations', 'custom-empty-snapshot.json.txt');
      });

      it('tells the user to write their sql into the file', async () => {
        await generate('--custom', '--name', 'backfill todos');

        expect(succeeded()).toMatch(/Empty migration created at .*_backfill_todos\./);
        expect(readLog()).toContain('Write your SQL in its migration.sql');
      });

      it('is applied in timestamp order alongside ordinary migrations', async () => {
        await generate('--name', 'first');
        await generate('--custom', '--name', 'backfill todos');

        tmp.write(
          'typebase/db/schema.ts',
          `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", { id: p.integer().primaryKey().generatedAlwaysAsIdentity() });
`
        );

        await generate('--name', 'third');

        expect(readMigrationFiles(path.join(tmp.path, 'typebase/db/migrations')).map(({ name }) => name)).toEqual(migrationNames());
      });
    });

    describe('migrate', () => {
      const migrate = (...args: string[]) => withCwd(tmp.path, () => db.parseAsync([...args], { from: 'user' }));

      const migrationsDirPath = () => path.join(tmp.path, 'typebase/db/migrations');

      it.each(['dev', 'prod'] as const)('applies pending migrations to the %s target', async (target) => {
        vi.mocked(applyMigrations).mockResolvedValue({ applied: ['20260101000000_first'] });

        await migrate(target, 'migrate');

        expect(neon).toHaveBeenCalledWith({ target });
        expect(applyMigrations).toHaveBeenCalledWith({ migrationsDirPath: migrationsDirPath(), connectionUri: 'postgres://neon/db' });
      });

      it('applies pending migrations to a local database given with --url', async () => {
        await migrate('local', 'migrate', '--url', 'postgres://local/db');

        expect(neon).not.toHaveBeenCalled();
        expect(applyMigrations).toHaveBeenCalledWith({ migrationsDirPath: migrationsDirPath(), connectionUri: 'postgres://local/db' });
      });

      it('falls back to DATABASE_URL from the environment for the local target', async () => {
        process.env.DATABASE_URL = 'postgres://env/db';

        await migrate('local', 'migrate');

        expect(applyMigrations).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://env/db' }));
      });

      it('reads DATABASE_URL from the .env file for the local target', async () => {
        tmp.write('.env', 'DATABASE_URL=postgres://file/db\n');

        await migrate('local', 'migrate');

        expect(applyMigrations).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://file/db' }));
      });

      it('throws when no local database url can be resolved', async () => {
        await expect(migrate('local', 'migrate')).rejects.toThrow('No database URL provided. Pass --url or set DATABASE_URL.');

        expect(applyMigrations).not.toHaveBeenCalled();
      });

      it('names each migration it applied', async () => {
        vi.mocked(applyMigrations).mockResolvedValue({ applied: ['20260101000000_first', '20260201000000_second'] });

        await migrate('dev', 'migrate');

        expect(succeeded()).toContain('2 migrations applied.');
        expect(readLog()).toContain('20260201000000_second');
      });

      it('names each migration it applied to the local target', async () => {
        vi.mocked(applyMigrations).mockResolvedValue({ applied: ['20260101000000_first', '20260201000000_second'] });

        await migrate('local', 'migrate', '--url', 'postgres://local/db');

        expect(succeeded()).toContain('2 migrations applied.');
        expect(readLog()).toContain('20260201000000_second');
      });

      it('uses the singular when one migration was applied to the local target', async () => {
        vi.mocked(applyMigrations).mockResolvedValue({ applied: ['20260101000000_first'] });

        await migrate('local', 'migrate', '--url', 'postgres://local/db');

        expect(succeeded()).toContain('1 migration applied.');
      });

      it('reports an up-to-date local target', async () => {
        vi.mocked(applyMigrations).mockResolvedValue({ applied: [] });
        vi.mocked(markMigrationApplied).mockResolvedValue({ marked: true });
        vi.mocked(findNeonTarget).mockResolvedValue({ connectionUri: 'postgres://neon/db' });

        await migrate('local', 'migrate', '--url', 'postgres://local/db');

        expect(succeeded()).toContain('Database is up to date. No migrations to apply.');
      });

      it('warns and still applies when the schema has unrecorded changes', async () => {
        await generate('--name', 'first');

        tmp.write(
          'typebase/db/schema.ts',
          `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),
  priority: p.integer(),
});
`
        );

        await migrate('dev', 'migrate');

        expect(warned()).toContain('Your schema files have changes that no migration records, affecting todos.');
        expect(applyMigrations).toHaveBeenCalledOnce();
      });

      it('does not generate the missing migration for the user', async () => {
        await generate('--name', 'first');

        tmp.write(
          'typebase/db/schema.ts',
          `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),
  priority: p.integer(),
});
`
        );

        const before = migrationNames();

        await migrate('dev', 'migrate');

        expect(migrationNames()).toEqual(before);
      });

      it('warns on the local target too', async () => {
        await generate('--name', 'first');

        tmp.write(
          'typebase/db/schema.ts',
          `import { p } from "typebase-io/db";

export const todos = p.pgTable("todos", {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),
  priority: p.integer(),
});
`
        );

        await migrate('local', 'migrate', '--url', 'postgres://local/db');

        expect(warned()).toContain('affecting todos');
      });

      it('says nothing about drift when every change is recorded', async () => {
        await generate('--name', 'first');

        await migrate('dev', 'migrate');

        expect(warned()).toBe('');
        expect(applyMigrations).toHaveBeenCalledOnce();
      });

      it('says nothing about drift on the local target when every change is recorded', async () => {
        await generate('--name', 'first');

        await migrate('local', 'migrate', '--url', 'postgres://local/db');

        expect(warned()).toBe('');
        expect(applyMigrations).toHaveBeenCalledOnce();
      });

      it('says nothing about drift on the local target when the project has no schema file', async () => {
        fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

        await migrate('local', 'migrate', '--url', 'postgres://local/db');

        expect(warned()).toBe('');
        expect(applyMigrations).toHaveBeenCalledOnce();
      });

      it('says nothing about drift when the project has no schema file', async () => {
        fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

        await migrate('dev', 'migrate');

        expect(warned()).toBe('');
        expect(applyMigrations).toHaveBeenCalledOnce();
      });

      it('uses the singular when one migration was applied', async () => {
        vi.mocked(applyMigrations).mockResolvedValue({ applied: ['20260101000000_first'] });

        await migrate('dev', 'migrate');

        expect(succeeded()).toContain('1 migration applied.');
      });

      it('reports an up-to-date target rather than naming nothing', async () => {
        vi.mocked(applyMigrations).mockResolvedValue({ applied: [] });
        vi.mocked(markMigrationApplied).mockResolvedValue({ marked: true });
        vi.mocked(findNeonTarget).mockResolvedValue({ connectionUri: 'postgres://neon/db' });

        await migrate('dev', 'migrate');

        expect(succeeded()).toContain('Database is up to date. No migrations to apply.');
      });

      it('surfaces the database error when a migration fails', async () => {
        vi.mocked(applyMigrations).mockRejectedValue(new Error('syntax error at or near "CREAT"'));

        await expect(migrate('dev', 'migrate')).rejects.toThrow('syntax error at or near "CREAT"');
      });

      it.each(['dev', 'prod', 'local'] as const)('refuses on the %s target when the project has no migrations', async (target) => {
        fs.rmSync(path.join(tmp.path, 'typebase/db/migrations'), { recursive: true });

        await expect(migrate(target, 'migrate')).rejects.toThrow('This project does not use migrations');

        expect(neon).not.toHaveBeenCalled();
        expect(applyMigrations).not.toHaveBeenCalled();
      });
    });

    describe('push', () => {
      it.each(['dev', 'prod'] as const)('refuses to push to %s and names the migrate command for that target', async (target) => {
        tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

        await expect(withCwd(tmp.path, () => db.parseAsync([target, 'push'], { from: 'user' }))).rejects.toThrow(
          `Run \`db ${target} migrate\` to apply your migrations instead.`
        );

        expect(neon).not.toHaveBeenCalled();
        expect(pushSchema).not.toHaveBeenCalled();
      });

      it('refuses to push to the local target', async () => {
        await expect(withCwd(tmp.path, () => db.parseAsync(['local', 'push', '--url', 'postgres://local/db'], { from: 'user' }))).rejects.toThrow(
          'Run `db local migrate` to apply your migrations instead.'
        );

        expect(pushSchema).not.toHaveBeenCalled();
      });

      it('does not prompt for a provider before refusing', async () => {
        await expect(withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }))).rejects.toThrow('This project uses migrations');

        expect(select).not.toHaveBeenCalled();
      });

      it('still pushes normally once the migrations directory is gone', async () => {
        tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

        fs.rmSync(path.join(tmp.path, 'typebase/db/migrations'), { recursive: true });

        await withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }));

        expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://neon/db' }));
      });
    });
  });

  describe('pull', () => {
    it('writes the pulled database to schema.ts and relations.ts', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(pullSchema).toHaveBeenCalledWith({ connectionUri: 'postgres://source/db' });
      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'schema.ts.txt');
      expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('db-pull', 'relations.ts.txt');
    });

    it('regenerates the types for the pulled schema', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(tmp.exists('typebase/_generated/db.d.ts')).toBe(true);
      expect(tmp.exists('typebase/_generated/server.ts')).toBe(true);
    });

    it('explains what was written and what to run next', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(readLog()).toEqualTemplate('db-pull', 'output.txt');
    });

    it('keeps a publisher project working when the database it reads already holds the events table', async () => {
      await generateTypebaseProject(tmp, { withPublisher: true });

      vi.mocked(applyMigrations).mockResolvedValue({ applied: [] });
      vi.mocked(markMigrationApplied).mockResolvedValue({ marked: true });
      vi.mocked(findNeonTarget).mockResolvedValue({ connectionUri: 'postgres://neon/db' });

      vi.mocked(pullSchema).mockResolvedValue({
        schema: readPulledSource('events-schema.ts.txt'),
        relations: readPulledSource('events-relations.ts.txt'),
      });

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'events-schema.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('db-pull', 'events-server.ts.txt');
    });

    it('refuses to leave a publisher project without the events table it needs', async () => {
      await generateTypebaseProject(tmp, { withPublisher: true });

      await expect(withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }))).rejects.toThrow(
        'does not export the `events` table'
      );
    });

    it('prompts for the connection string when --url is omitted', async () => {
      vi.mocked(input).mockResolvedValue('  postgres://prompted/db  ');

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--force'], { from: 'user' }));

      expect(input).toHaveBeenCalledOnce();
      expect(pullSchema).toHaveBeenCalledWith({ connectionUri: 'postgres://prompted/db' });
    });

    it('rejects an empty connection string at the prompt', async () => {
      vi.mocked(input).mockResolvedValue('postgres://prompted/db');

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--force'], { from: 'user' }));

      const { validate } = vi.mocked(input).mock.calls[0]?.[0] ?? {};

      expect(validate?.('')).toBe('A connection string is required.');
      expect(validate?.('   ')).toBe('A connection string is required.');
      expect(validate?.('postgres://source/db')).toBe(true);
    });

    it('asks before replacing existing db files', async () => {
      vi.mocked(confirm).mockImplementation(({ message }) => Promise.resolve(message === 'Overwrite them?'));

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db'], { from: 'user' }));

      expect(asked()).toContain('Overwrite them?');
      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'schema.ts.txt');
    });

    it('leaves the auth warning out of the prompt when the project has no auth', async () => {
      fs.rmSync(path.join(tmp.path, 'typebase/auth.ts'));
      vi.mocked(confirm).mockResolvedValue(false);

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db'], { from: 'user' }));

      expect(readLog()).toEqualTemplate('db-pull', 'overwrite-prompt.txt');
    });

    it('writes nothing when the prompt is declined', async () => {
      vi.mocked(confirm).mockResolvedValue(false);

      const schemaBefore = tmp.read('typebase/db/schema.ts');

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db'], { from: 'user' }));

      expect(pullSchema).not.toHaveBeenCalled();
      expect(tmp.read('typebase/db/schema.ts')).toBe(schemaBefore);
    });

    it('skips the prompt when --force is passed', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(asked()).not.toContain('Overwrite them?');
    });

    it('does not ask when there is nothing to replace', async () => {
      fs.rmSync(path.join(tmp.path, 'typebase/db'), { recursive: true });

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db'], { from: 'user' }));

      expect(asked()).not.toContain('Overwrite them?');
      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'schema.ts.txt');
    });

    it('leaves the project alone when the database has no tables', async () => {
      const schemaBefore = tmp.read('typebase/db/schema.ts');

      vi.mocked(applyMigrations).mockResolvedValue({ applied: [] });
      vi.mocked(markMigrationApplied).mockResolvedValue({ marked: true });
      vi.mocked(findNeonTarget).mockResolvedValue({ connectionUri: 'postgres://neon/db' });

      vi.mocked(pullSchema).mockResolvedValue({
        schema: readPulledSource('empty-schema.ts.txt'),
        relations: readPulledSource('empty-relations.ts.txt'),
      });

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(tmp.read('typebase/db/schema.ts')).toBe(schemaBefore);
    });

    it('warns about tables pulled in from another schema', async () => {
      vi.mocked(applyMigrations).mockResolvedValue({ applied: [] });
      vi.mocked(markMigrationApplied).mockResolvedValue({ marked: true });
      vi.mocked(findNeonTarget).mockResolvedValue({ connectionUri: 'postgres://neon/db' });

      vi.mocked(pullSchema).mockResolvedValue({
        schema: readPulledSource('cross-schema-schema.ts.txt'),
        relations: readPulledSource('cross-schema-relations.ts.txt'),
      });

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'cross-schema', 'schema.ts.txt');
      expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('db-pull', 'cross-schema', 'relations.ts.txt');
      expect(readLog()).toEqualTemplate('db-pull', 'cross-schema', 'output.txt');
    });

    it('throws when the project has not been initialized', async () => {
      fs.rmSync(path.join(tmp.path, 'typebase/tsconfig.json'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }))).rejects.toThrow(
        'No Typebase project found at `typebase`. Run `init` first.'
      );

      expect(pullSchema).not.toHaveBeenCalled();
    });

    it('names the current directory when the project lives in it', async () => {
      tmp.write('typebase.json', JSON.stringify({ projectPath: '.' }));

      await expect(withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }))).rejects.toThrow(
        'No Typebase project found at `.`. Run `init` first.'
      );
    });

    it('propagates a failure from pullSchema', async () => {
      vi.mocked(pullSchema).mockRejectedValueOnce(new Error('could not connect'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }))).rejects.toThrow(
        'could not connect'
      );
    });
  });

  describe('migrations init', () => {
    const adopt = () => withCwd(tmp.path, () => db.parseAsync(['migrations', 'init'], { from: 'user' }));

    const migrationsRoot = () => path.join(tmp.path, 'typebase/db/migrations');

    const baselineNames = () => (fs.existsSync(migrationsRoot()) ? fs.readdirSync(migrationsRoot()) : []);

    const readSql = (name: string) => fs.readFileSync(path.join(migrationsRoot(), name, 'migration.sql'), 'utf8');

    const infos = () =>
      vi
        .mocked(ora())
        .info.mock.calls.flat()
        .map((line) => stripColours(String(line)))
        .join('\n');

    beforeEach(async () => {
      await generateTypebaseProject(tmp, { withAuth: false });

      vi.mocked(confirm).mockImplementation(({ message }) => Promise.resolve(message.startsWith('Record a baseline')));
    });

    it('asks before recording or marking anything', async () => {
      await adopt();

      expect(asked()).toContain('Record a baseline for your current schema and mark dev and prod as having applied it?');
    });

    it('names only the targets that exist in what it asks', async () => {
      vi.mocked(findNeonTarget).mockImplementation(({ target }) =>
        Promise.resolve(target === 'dev' ? { connectionUri: 'postgres://neon/db' } : undefined)
      );

      await adopt();

      expect(asked()).toContain('Record a baseline for your current schema and mark dev as having applied it?');
    });

    it('mentions no marking when no target has a database', async () => {
      vi.mocked(findNeonTarget).mockResolvedValue(undefined);

      await adopt();

      expect(asked()).toContain('Record a baseline for your current schema?');
    });

    it('records nothing and touches no target when the prompt is declined', async () => {
      vi.mocked(confirm).mockResolvedValue(false);

      await adopt();

      expect(baselineNames()).toHaveLength(0);
      expect(markMigrationApplied).not.toHaveBeenCalled();
      expect(pushSchema).not.toHaveBeenCalled();
      expect(succeeded()).not.toContain('Baseline recorded');
    });

    it('compares nothing against a target when the prompt is declined', async () => {
      vi.mocked(confirm).mockResolvedValue(false);

      await adopt();

      expect(pushSchema).not.toHaveBeenCalled();
    });

    it('records a baseline holding creation sql for the whole schema', async () => {
      await adopt();

      const [name = ''] = baselineNames();

      expect(name).toMatch(/^\d{14}_baseline$/);
      expect(readSql(name)).toEqualTemplate('db-migrations', 'initial.sql.txt');
    });

    it('compares each existing target without applying anything', async () => {
      await adopt();

      expect(pushSchema).toHaveBeenCalledTimes(2);
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://neon/db', dryRun: true }));

      expect(vi.mocked(pushSchema).mock.calls.map(([{ dryRun }]) => dryRun)).toEqual([true, true]);
    });

    it('marks every existing target as having applied the baseline', async () => {
      await adopt();

      const [name = ''] = baselineNames();

      expect(markMigrationApplied).toHaveBeenCalledTimes(2);
      expect(markMigrationApplied).toHaveBeenCalledWith({ migrationsDirPath: migrationsRoot(), connectionUri: 'postgres://neon/db', name });
      expect(succeeded()).toContain(`dev marked as having applied ${name}.`);
      expect(succeeded()).toContain(`prod marked as having applied ${name}.`);
    });

    it('never provisions a target that has no database, and reports it', async () => {
      vi.mocked(findNeonTarget).mockImplementation(({ target }) =>
        Promise.resolve(target === 'dev' ? { connectionUri: 'postgres://neon/db' } : undefined)
      );

      await adopt();

      expect(neon).not.toHaveBeenCalled();
      expect(markMigrationApplied).toHaveBeenCalledOnce();
      expect(infos()).toContain('No prod database yet.');
    });

    it('records the baseline even when no target exists at all', async () => {
      vi.mocked(findNeonTarget).mockResolvedValue(undefined);

      await adopt();

      expect(baselineNames()).toHaveLength(1);
      expect(pushSchema).not.toHaveBeenCalled();
      expect(markMigrationApplied).not.toHaveBeenCalled();
    });

    it('offers to bring an out-of-step target in line before baselining', async () => {
      vi.mocked(pushSchema).mockResolvedValueOnce({ sqlStatements: ['ALTER TABLE "todos" ADD COLUMN "priority" integer;'] });
      vi.mocked(confirm).mockResolvedValue(true);

      await adopt();

      expect(warned()).toContain('Your dev database does not match your schema files.');

      expect(vi.mocked(pushSchema).mock.calls.map(([{ dryRun }]) => dryRun)).toEqual([true, undefined, true]);
      expect(vi.mocked(pushSchema).mock.calls.map(([{ skipConfirmation }]) => skipConfirmation)).toEqual([true, false, true]);
      expect(baselineNames()).toHaveLength(1);
    });

    it('refuses to baseline a target the user declined to bring in line', async () => {
      vi.mocked(pushSchema).mockResolvedValueOnce({ sqlStatements: ['ALTER TABLE "todos" ADD COLUMN "priority" integer;'] });

      await expect(adopt()).rejects.toThrow('Cannot record a baseline while dev does not match your schema files.');

      expect(baselineNames()).toHaveLength(0);
      expect(markMigrationApplied).not.toHaveBeenCalled();
    });

    it('generates nothing on a second run and only marks', async () => {
      await adopt();

      const before = baselineNames();

      vi.mocked(markMigrationApplied).mockResolvedValue({ marked: false });

      await adopt();

      expect(baselineNames()).toEqual(before);
      expect(succeeded()).toContain('was already marked.');
    });

    it('refuses in a project that uses migrations without a baseline', async () => {
      tmp.mkdir('typebase/db/migrations');

      await withCwd(tmp.path, () => db.parseAsync(['migrations', 'generate', '--name', 'first'], { from: 'user' }));

      await expect(adopt()).rejects.toThrow('This project already uses migrations and has no baseline to adopt.');
    });

    it('throws when the project has no schema', async () => {
      fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

      await expect(adopt()).rejects.toThrow('No database schema found. Create a schema file at db/schema.ts.');

      expect(findNeonTarget).not.toHaveBeenCalled();
    });

    it('leaves the project ready to migrate, applying nothing to a marked target', async () => {
      await adopt();

      await withCwd(tmp.path, () => db.parseAsync(['dev', 'migrate'], { from: 'user' }));

      expect(applyMigrations).toHaveBeenCalledWith({ migrationsDirPath: migrationsRoot(), connectionUri: 'postgres://neon/db' });
    });
  });

  describe('pull in migrations mode', () => {
    const migrationsRoot = () => path.join(tmp.path, 'typebase/db/migrations');

    const migrationNames = () => (fs.existsSync(migrationsRoot()) ? fs.readdirSync(migrationsRoot()).sort((a, b) => a.localeCompare(b)) : []);

    const pull = (...args: string[]) => withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', ...args], { from: 'user' }));

    const enterMigrationsMode = async () => {
      await generateTypebaseProject(tmp, { withAuth: false });

      tmp.mkdir('typebase/db/migrations');

      await withCwd(tmp.path, () => db.parseAsync(['migrations', 'generate', '--name', 'first'], { from: 'user' }));
    };

    it('refuses without --force, explaining why', async () => {
      await enterMigrationsMode();

      await expect(pull()).rejects.toThrow('This project records its schema as migrations');

      expect(pullSchema).not.toHaveBeenCalled();
    });

    it('leaves the recorded history alone when it refuses', async () => {
      await enterMigrationsMode();

      const before = migrationNames();

      await expect(pull()).rejects.toThrow('--force');

      expect(migrationNames()).toEqual(before);
    });

    it('replaces the history with a single baseline built from what was pulled', async () => {
      await enterMigrationsMode();

      await pull('--force');

      expect(migrationNames()).toEqual([expect.stringMatching(/^\d{14}_baseline$/)]);
      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'schema.ts.txt');
    });

    it('records a baseline that describes what was pulled', async () => {
      await enterMigrationsMode();

      await pull('--force');

      const [name = ''] = migrationNames();
      const sql = fs.readFileSync(path.join(migrationsRoot(), name, 'migration.sql'), 'utf8');

      expect(sql).toContain('CREATE TABLE "todo_labels"');
      expect(sql).not.toContain('"completed" boolean');
    });

    it('compares nothing against a target while rebaselining', async () => {
      await enterMigrationsMode();

      await pull('--force');

      expect(pushSchema).not.toHaveBeenCalled();
      expect(findNeonTarget).not.toHaveBeenCalled();
    });

    it('changes no remote bookkeeping', async () => {
      await enterMigrationsMode();

      await pull('--force');

      expect(markMigrationApplied).not.toHaveBeenCalled();
      expect(applyMigrations).not.toHaveBeenCalled();
      expect(neon).not.toHaveBeenCalled();
    });

    it('tells the user every target has to be re-marked, and how', async () => {
      await enterMigrationsMode();

      await pull('--force');

      expect(readLog()).toContain('every target has to be marked against the new baseline');
      expect(readLog()).toContain('npx typebase-io-cli db migrations init');
    });

    it('never leaves the migrations folder empty', async () => {
      await enterMigrationsMode();

      await pull('--force');

      expect(migrationNames()).toHaveLength(1);
      expect(fs.readdirSync(path.join(migrationsRoot(), migrationNames()[0] ?? ''))).toContain('snapshot.json');
    });
  });

  describe('pull in a project without migrations', () => {
    const migrationsRoot = () => path.join(tmp.path, 'typebase/db/migrations');

    const pull = () => withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

    it('offers to start using migrations', async () => {
      vi.mocked(confirm).mockResolvedValue(false);

      await pull();

      expect(asked()).toContain('Record this schema as a migration and start using migrations?');
    });

    it('leaves the project in push mode when the offer is declined', async () => {
      vi.mocked(confirm).mockResolvedValue(false);

      await pull();

      expect(fs.existsSync(migrationsRoot())).toBe(false);
      expect(readLog()).toContain('npx typebase-io-cli db dev push');
    });

    it('records a baseline matching what was pulled when the offer is accepted', async () => {
      vi.mocked(confirm).mockResolvedValue(true);

      await pull();

      const names = fs.readdirSync(migrationsRoot());
      const [name = ''] = names;

      expect(names).toHaveLength(1);
      expect(name).toMatch(/^\d{14}_baseline$/);
      expect(fs.readFileSync(path.join(migrationsRoot(), name, 'migration.sql'), 'utf8')).toContain('CREATE TABLE "users"');
    });

    it('points at adoption rather than push once migrations are on', async () => {
      vi.mocked(confirm).mockResolvedValue(true);

      await pull();

      expect(readLog()).toContain('npx typebase-io-cli db migrations init');
      expect(readLog()).not.toContain('npx typebase-io-cli db dev push');
    });
  });
});
