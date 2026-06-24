import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { init } from '#commands/init.ts';

import { generateAuthSchema } from '#helpers/auth/generate-auth-schema.ts';
import { generateExampleActions } from '#helpers/init/generate-example-actions.ts';
import { generateExampleAuth } from '#helpers/init/generate-example-auth.ts';
import { generateExampleRelations } from '#helpers/init/generate-example-relations.ts';
import { generateExampleSchema } from '#helpers/init/generate-example-schema.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

import { expectProject } from '#tests/helpers/expect-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
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
vi.mock('#helpers/init/generate-example-relations.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/init/generate-example-schema.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/generate-db-types.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/generate-server-types.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/generate-ts-config.ts', async (o) => passThrough(await o<Record<string, unknown>>()));
vi.mock('#helpers/shared/get-typebase-config.ts', async (o) => passThrough(await o<Record<string, unknown>>()));

describe('init command', () => {
  let tmp: TempDir;

  beforeEach(() => {
    vi.clearAllMocks();
    tmp = createTempDir();

    linkTypebaseIo(tmp);

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
        'tsconfig.json',
      ],
      { namespace: 'init' }
    );
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
        'tsconfig.json',
      ],
      { namespace: 'init' }
    );

    const warnings = vi.mocked(console.warn).mock.calls.flat().map(String).join('\n');
    expect(warnings).toContain('Base URL could not be determined');
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
  });

  it('rejects conflicting --with-auth and --skip-example options', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await expect(withCwd(tmp.path, () => init.parseAsync(['--with-auth', '--skip-example'], { from: 'user' }))).rejects.toThrow(
      'process.exit called'
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(listFiles(path.join(tmp.path, 'typebase'))).toEqual([]);
  });

  describe('propagates generator failures', () => {
    const cases: { name: string; mock: () => { mockRejectedValueOnce: (e: Error) => unknown }; args: string[] }[] = [
      { name: 'getTypebaseConfig', mock: () => vi.mocked(getTypebaseConfig), args: [] },
      { name: 'generateTsConfig', mock: () => vi.mocked(generateTsConfig), args: [] },
      { name: 'generateExampleSchema', mock: () => vi.mocked(generateExampleSchema), args: [] },
      { name: 'generateExampleRelations', mock: () => vi.mocked(generateExampleRelations), args: [] },
      { name: 'generateExampleActions', mock: () => vi.mocked(generateExampleActions), args: [] },
      { name: 'generateDBTypes', mock: () => vi.mocked(generateDBTypes), args: [] },
      { name: 'generateServerTypes', mock: () => vi.mocked(generateServerTypes), args: [] },
      { name: 'generateExampleAuth', mock: () => vi.mocked(generateExampleAuth), args: ['--with-auth'] },
      { name: 'generateAuthSchema', mock: () => vi.mocked(generateAuthSchema), args: ['--with-auth'] },
    ];

    it.each(cases)('rejects when $name throws', async ({ mock, args }) => {
      mock().mockRejectedValueOnce(new Error('boom'));

      await expect(withCwd(tmp.path, () => init.parseAsync(args, { from: 'user' }))).rejects.toThrow('boom');
    });
  });
});
