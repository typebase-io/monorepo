import fs from 'node:fs';
import path from 'node:path';

import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { init } from '#commands/init.ts';

import { generateAuthSchema } from '#helpers/auth/generate-auth-schema.ts';
import { TYPEBASE_CONFIG_SCHEMA_URL } from '#helpers/constants.ts';
import { readMigrationFiles } from '#helpers/db/read-migration-files.ts';
import { generateExampleActions } from '#helpers/init/generate-example-actions.ts';
import { generateExampleAuth } from '#helpers/init/generate-example-auth.ts';
import { generateExamplePublisher } from '#helpers/init/generate-example-publisher.ts';
import { generateExampleRelations } from '#helpers/init/generate-example-relations.ts';
import { generateExampleSchema } from '#helpers/init/generate-example-schema.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

import { expectProject } from '#tests/helpers/expect-project.ts';
import { linkBetterAuth } from '#tests/helpers/link-better-auth.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { linkZod } from '#tests/helpers/link-zod.ts';
import { listFiles } from '#tests/helpers/list-files.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const { passThrough } = vi.hoisted(() => ({
  passThrough: (actual: Record<string, unknown>): Record<string, unknown> => {
    const mocked = { ...actual };

    for (const [key, value] of Object.entries(actual)) {
      if (typeof value === 'function') mocked[key] = vi.fn(value as (...args: unknown[]) => unknown);
    }

    return mocked;
  },
}));

vi.mock('#helpers/auth/generate-auth-schema.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/init/generate-example-actions.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/init/generate-example-auth.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/init/generate-example-publisher.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/init/generate-example-relations.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/init/generate-example-schema.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/generate-db-types.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/generate-server-types.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/generate-ts-config.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/get-typebase-config.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/write-typebase-config.ts', async (o) => passThrough(await o<Record<string, unknown>>()));

describe('init command', () => {
  let tmp: TempDir;

  beforeEach(() => {
    vi.clearAllMocks();
    tmp = createTempDir();

    linkTypebaseIo(tmp);
    linkBetterAuth(tmp);
    linkZod(tmp);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it('scaffolds the default example project', async () => {
    await withCwd(tmp.path, () => init.parseAsync([], { from: 'user' }));

    expectProject(
      tmp,
      'default',
      [
        '_generated/db.d.ts',
        '_generated/server.ts',
        'actions/mutations/todos.ts',
        'actions/queries/todos.ts',
        'db/relations.ts',
        'db/schema.ts',
        'env.ts',
        'tsconfig.json',
      ],
      { namespace: 'init' }
    );
  });

  it('creates a `typebase.json` holding nothing but the `$schema` reference', async () => {
    await withCwd(tmp.path, () => init.parseAsync([], { from: 'user' }));

    expect(JSON.parse(tmp.read('typebase.json'))).toEqual({ $schema: TYPEBASE_CONFIG_SCHEMA_URL });
  });

  it('keeps the values already in `typebase.json`', async () => {
    tmp.write('typebase.json', JSON.stringify({ serverProvider: 'cloudflare', server: { port: 9000 } }));

    await withCwd(tmp.path, () => init.parseAsync([], { from: 'user' }));

    expect(JSON.parse(tmp.read('typebase.json'))).toEqual({
      $schema: TYPEBASE_CONFIG_SCHEMA_URL,
      serverProvider: 'cloudflare',
      server: { port: 9000 },
    });
  });

  it('scaffolds the example project with auth', async () => {
    await withCwd(tmp.path, () => init.parseAsync(['--with-auth'], { from: 'user' }));

    expectProject(
      tmp,
      'with-auth',
      [
        '_generated/db.d.ts',
        '_generated/server.ts',
        'actions/custom-actions.ts',
        'actions/mutations/todos.ts',
        'actions/queries/todos.ts',
        'auth.ts',
        'db/relations.ts',
        'db/schema.ts',
        'env.ts',
        'tsconfig.json',
      ],
      { namespace: 'init' }
    );

    const warnings = vi.mocked(console.warn).mock.calls.flat().map(String).join('\n');

    expect(warnings).toContain('Base URL could not be determined');
  });

  it('scaffolds the example project with a db publisher', async () => {
    await withCwd(tmp.path, () => init.parseAsync(['--with-db-publisher'], { from: 'user' }));

    expectProject(
      tmp,
      'with-db-publisher',
      [
        '_generated/db.d.ts',
        '_generated/server.ts',
        'actions/mutations/todos.ts',
        'actions/queries/todos.ts',
        'db/relations.ts',
        'db/schema.ts',
        'env.ts',
        'publisher.ts',
        'tsconfig.json',
      ],
      { namespace: 'init' }
    );
  });

  it('scaffolds a db publisher alongside auth, keeping the relations auth registered', async () => {
    await withCwd(tmp.path, () => init.parseAsync(['--with-auth', '--with-db-publisher'], { from: 'user' }));

    expectProject(
      tmp,
      'with-auth-and-db-publisher',
      [
        '_generated/db.d.ts',
        '_generated/server.ts',
        'actions/custom-actions.ts',
        'actions/mutations/todos.ts',
        'actions/queries/todos.ts',
        'auth.ts',
        'db/relations.ts',
        'db/schema.ts',
        'env.ts',
        'publisher.ts',
        'tsconfig.json',
      ],
      { namespace: 'init' }
    );
  });

  it('scaffolds a bare project without examples when --skip-example is passed', async () => {
    await withCwd(tmp.path, () => init.parseAsync(['--skip-example'], { from: 'user' }));

    expectProject(tmp, 'skip-example', ['_generated/db.d.ts', '_generated/server.ts', 'db/relations.ts', 'db/schema.ts', 'tsconfig.json'], {
      namespace: 'init',
    });
  });

  it('errors and generates nothing when a tsconfig already exists without --force', async () => {
    tmp.write('typebase/tsconfig.json', '{ "existing": true }');

    await withCwd(tmp.path, () => init.parseAsync([], { from: 'user' }));

    expect(process.exitCode).toBe(1);
    expect(vi.mocked(console.error).mock.calls[0]?.[0]).toContain('already exists');
    expect(tmp.read('typebase/tsconfig.json')).toBe('{ "existing": true }');
    expect(listFiles(path.join(tmp.path, 'typebase'))).toEqual(['tsconfig.json']);
    expect(tmp.exists('typebase.json')).toBe(false);
  });

  it('regenerates the project when --force is passed over an existing tsconfig', async () => {
    tmp.write('typebase/tsconfig.json', '{ "existing": true }');

    await withCwd(tmp.path, () => init.parseAsync(['--force'], { from: 'user' }));

    expect(process.exitCode).toBe(0);

    expectProject(
      tmp,
      'default',
      [
        '_generated/db.d.ts',
        '_generated/server.ts',
        'actions/mutations/todos.ts',
        'actions/queries/todos.ts',
        'db/relations.ts',
        'db/schema.ts',
        'env.ts',
        'tsconfig.json',
      ],
      { namespace: 'init' }
    );
  });

  it('scaffolds into the current directory when the project path is "."', async () => {
    tmp.write('typebase.json', JSON.stringify({ projectPath: '.' }));

    await withCwd(tmp.path, () => init.parseAsync([], { from: 'user' }));

    expect(process.exitCode).toBe(0);
    expect(tmp.read('tsconfig.json')).toEqualTemplate('init', 'default', 'tsconfig.json.txt');
    expect(tmp.read('db/schema.ts')).toEqualTemplate('init', 'default', 'db', 'schema.ts.txt');
    expect(JSON.parse(tmp.read('typebase.json'))).toEqual({ $schema: TYPEBASE_CONFIG_SCHEMA_URL, projectPath: '.' });
  });

  it.each([['--with-auth'], ['--with-db-publisher']])('rejects %s together with --skip-example, since it has no example to add to', async (flag) => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await expect(withCwd(tmp.path, () => init.parseAsync([flag, '--skip-example'], { from: 'user' }))).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(listFiles(path.join(tmp.path, 'typebase'))).toEqual([]);
  });

  describe('propagates generator failures', () => {
    const cases: { name: string; mock: () => { mockRejectedValueOnce: (e: Error) => unknown }; args: string[] }[] = [
      { name: 'getTypebaseConfig', mock: () => vi.mocked(getTypebaseConfig), args: [] },
      { name: 'writeTypebaseConfig', mock: () => vi.mocked(writeTypebaseConfig), args: [] },
      { name: 'generateTsConfig', mock: () => vi.mocked(generateTsConfig), args: [] },
      { name: 'generateExampleSchema', mock: () => vi.mocked(generateExampleSchema), args: [] },
      { name: 'generateExampleRelations', mock: () => vi.mocked(generateExampleRelations), args: [] },
      { name: 'generateExampleActions', mock: () => vi.mocked(generateExampleActions), args: [] },
      { name: 'generateDBTypes', mock: () => vi.mocked(generateDBTypes), args: [] },
      { name: 'generateServerTypes', mock: () => vi.mocked(generateServerTypes), args: [] },
      { name: 'generateExampleAuth', mock: () => vi.mocked(generateExampleAuth), args: ['--with-auth'] },
      { name: 'generateAuthSchema', mock: () => vi.mocked(generateAuthSchema), args: ['--with-auth'] },
      { name: 'generateExamplePublisher', mock: () => vi.mocked(generateExamplePublisher), args: ['--with-db-publisher'] },
    ];

    it.each(cases)('rejects when $name throws', async ({ mock, args }) => {
      mock().mockRejectedValueOnce(new Error('boom'));

      await expect(withCwd(tmp.path, () => init.parseAsync(args, { from: 'user' }))).rejects.toThrow('boom');
    });
  });

  describe('--with-migrations', () => {
    const MIGRATION_FILES = ['db/migrations/20260101000000_initial/migration.sql', 'db/migrations/20260101000000_initial/snapshot.json'];

    const withoutIds = (contents: string) =>
      contents.replaceAll(/(?!00000000-0000-0000-0000-000000000000)[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/g, '<uuid>');

    const migrationsDirPath = () => path.join(tmp.path, 'typebase/db/migrations');

    const runInit = (...args: string[]) => withCwd(tmp.path, () => init.parseAsync(['--with-migrations', ...args], { from: 'user' }));

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      {
        outcome: 'with-migrations',
        args: [],
        files: [
          '_generated/db.d.ts',
          '_generated/server.ts',
          'actions/mutations/todos.ts',
          'actions/queries/todos.ts',
          ...MIGRATION_FILES,
          'db/relations.ts',
          'db/schema.ts',
          'env.ts',
          'tsconfig.json',
        ],
      },
      {
        outcome: 'with-migrations-and-auth',
        args: ['--with-auth'],
        files: [
          '_generated/db.d.ts',
          '_generated/server.ts',
          'actions/custom-actions.ts',
          'actions/mutations/todos.ts',
          'actions/queries/todos.ts',
          'auth.ts',
          ...MIGRATION_FILES,
          'db/relations.ts',
          'db/schema.ts',
          'env.ts',
          'tsconfig.json',
        ],
      },
      {
        outcome: 'with-migrations-and-db-publisher',
        args: ['--with-db-publisher'],
        files: [
          '_generated/db.d.ts',
          '_generated/server.ts',
          'actions/mutations/todos.ts',
          'actions/queries/todos.ts',
          ...MIGRATION_FILES,
          'db/relations.ts',
          'db/schema.ts',
          'env.ts',
          'publisher.ts',
          'tsconfig.json',
        ],
      },
      {
        outcome: 'with-migrations-auth-and-db-publisher',
        args: ['--with-auth', '--with-db-publisher'],
        files: [
          '_generated/db.d.ts',
          '_generated/server.ts',
          'actions/custom-actions.ts',
          'actions/mutations/todos.ts',
          'actions/queries/todos.ts',
          'auth.ts',
          ...MIGRATION_FILES,
          'db/relations.ts',
          'db/schema.ts',
          'env.ts',
          'publisher.ts',
          'tsconfig.json',
        ],
      },
      {
        outcome: 'with-migrations-skip-example',
        args: ['--skip-example'],
        files: [
          '_generated/db.d.ts',
          '_generated/server.ts',
          'db/migrations/20260101000000_initial/snapshot.json',
          'db/relations.ts',
          'db/schema.ts',
          'tsconfig.json',
        ],
      },
    ])('scaffolds $outcome', async ({ outcome, args, files }) => {
      await runInit(...args);

      expectProject(tmp, outcome, files, { namespace: 'init', normalise: withoutIds });
    });

    it('records exactly one migration, whatever the flags', async () => {
      await runInit('--with-auth', '--with-db-publisher');

      expect(fs.readdirSync(migrationsDirPath())).toEqual(['20260101000000_initial']);
    });

    it('creates every table before the foreign keys that reference it', async () => {
      await runInit('--with-auth', '--with-db-publisher');

      const sql = fs.readFileSync(path.join(migrationsDirPath(), '20260101000000_initial/migration.sql'), 'utf8');

      for (const [, table] of sql.matchAll(/REFERENCES "([^"]+)"/g)) {
        expect(sql.indexOf(`CREATE TABLE "${table}"`)).toBeGreaterThanOrEqual(0);
        expect(sql.indexOf(`CREATE TABLE "${table}"`)).toBeLessThan(sql.indexOf(`REFERENCES "${table}"`));
      }
    });

    it('records the migration in the form the migrator applies', async () => {
      await runInit('--with-auth', '--with-db-publisher');

      const [migration] = readMigrationFiles(migrationsDirPath());

      expect(migration?.sql.length).toBeGreaterThan(1);
      expect(migration?.sql.every((statement) => statement.trim().endsWith(';'))).toBe(true);
    });

    it('builds the schema without starting a second spinner over the one init owns', async () => {
      await runInit();

      const started = vi
        .mocked(ora)
        .mock.calls.flat()
        .filter((message) => typeof message === 'string')
        .join('\n');

      expect(started).not.toContain('Building schema...');
    });

    it('leaves a project without the flag in push mode', async () => {
      await withCwd(tmp.path, () => init.parseAsync([], { from: 'user' }));

      expect(fs.existsSync(migrationsDirPath())).toBe(false);
    });
  });
});
