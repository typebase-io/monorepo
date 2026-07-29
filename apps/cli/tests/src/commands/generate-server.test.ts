import fs from 'node:fs';
import path from 'node:path';

import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateServer } from '#commands/generate-server.ts';

import { generatePackageJson } from '#helpers/generate-server/generate-package-json.ts';
import { validateTypes } from '#helpers/shared/validate-types.ts';

import { expectProject } from '#tests/helpers/expect-project.ts';
import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkBetterAuth } from '#tests/helpers/link-better-auth.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
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

vi.mock('#helpers/shared/validate-types.ts', () => ({ validateTypes: vi.fn() }));
vi.mock('#helpers/generate-server/generate-package-json.ts', async (o) => passThrough(await o<Record<string, unknown>>()));

const TS_AUTH_DB = [
  'package.json',
  'src/_generated/server.ts',
  'src/actions/custom-actions.ts',
  'src/actions/mutations/todos.ts',
  'src/actions/queries/todos.ts',
  'src/auth.ts',
  'src/db/drizzle.config.ts',
  'src/db/index.ts',
  'src/db/relations.ts',
  'src/db/schema.ts',
  'src/index.ts',
  'tsconfig.json',
];

const JS_AUTH_DB = TS_AUTH_DB.filter((f) => f !== 'tsconfig.json').map((f) => (f.endsWith('.ts') ? f.replace(/\.ts$/, '.js') : f));
const TS_DB_ONLY = TS_AUTH_DB.filter((f) => f !== 'src/auth.ts' && f !== 'src/actions/custom-actions.ts');
const TS_AUTH_ONLY = TS_AUTH_DB.filter((f) => !f.startsWith('src/db/'));
const TS_BARE = TS_AUTH_DB.filter((f) => !f.startsWith('src/db/') && f !== 'src/auth.ts' && f !== 'src/actions/custom-actions.ts');

describe('generate-server command', () => {
  let tmp: TempDir;

  beforeEach(() => {
    vi.clearAllMocks();

    tmp = createTempDir();

    linkTypebaseIo(tmp);
    linkBetterAuth(tmp);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();

    process.exitCode = 0;

    vi.restoreAllMocks();
  });

  const setupProject = async ({ withAuth, withDb }: { withAuth: boolean; withDb: boolean }) => {
    await generateTypebaseProject(tmp, { withAuth });

    if (!withDb) {
      fs.rmSync(path.join(tmp.path, 'typebase/db'), { recursive: true, force: true });
    }
  };

  const succeeded = () => vi.mocked(ora()).succeed.mock.calls.flat().map(String).join('\n');

  const expectServer = (outcome: string, files: string[], root = '_server') => {
    expectProject(tmp, outcome, files, { namespace: 'generate-server', root: `typebase/${root}` });
  };

  describe('generates the expected project for each flag combination', () => {
    const cases = [
      { name: 'ts-auth-db', withAuth: true, withDb: true, args: [] as string[], files: TS_AUTH_DB, root: '_server' },
      { name: 'esm-auth-db', withAuth: true, withDb: true, args: ['--output', 'esm'], files: JS_AUTH_DB, root: '_server' },
      { name: 'cjs-auth-db', withAuth: true, withDb: true, args: ['--output', 'cjs'], files: JS_AUTH_DB, root: '_server' },
      { name: 'ts-db-only', withAuth: false, withDb: true, args: [], files: TS_DB_ONLY, root: '_server' },
      { name: 'ts-auth-only', withAuth: true, withDb: false, args: [], files: TS_AUTH_ONLY, root: '_server' },
      { name: 'ts-bare', withAuth: false, withDb: false, args: [], files: TS_BARE, root: '_server' },
      { name: 'ts-skip-load-env', withAuth: true, withDb: true, args: ['--skip-load-env'], files: TS_AUTH_DB, root: '_server' },
      { name: 'ts-port', withAuth: true, withDb: true, args: ['--port', '3000'], files: TS_AUTH_DB, root: '_server' },
      { name: 'ts-out-dir', withAuth: true, withDb: true, args: ['--out-dir', 'dist'], files: TS_AUTH_DB, root: 'dist' },
      { name: 'adapter-bun', withAuth: true, withDb: true, args: ['--adapter', 'bun'], files: TS_AUTH_DB, root: '_server' },
      { name: 'adapter-cloudflare', withAuth: true, withDb: true, args: ['--adapter', 'cloudflare'], files: TS_AUTH_DB, root: '_server' },
      { name: 'adapter-deno', withAuth: true, withDb: true, args: ['--adapter', 'deno'], files: TS_AUTH_DB, root: '_server' },
      { name: 'adapter-fastify', withAuth: true, withDb: true, args: ['--adapter', 'fastify'], files: TS_AUTH_DB, root: '_server' },
      { name: 'adapter-hono', withAuth: true, withDb: true, args: ['--adapter', 'hono'], files: TS_AUTH_DB, root: '_server' },
    ];

    it.each(cases)('generates the $name server', async ({ name, withAuth, withDb, args, files, root }) => {
      await setupProject({ withAuth, withDb });

      await withCwd(tmp.path, () => generateServer.parseAsync(args, { from: 'user' }));

      expectServer(name, files, root);
    });
  });

  describe('reads options from typebase.json', () => {
    it('uses the configured output, matching the equivalent flag run', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { output: 'esm' } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('esm-auth-db', JS_AUTH_DB);
    });

    it('uses the configured adapter', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { adapter: 'bun' } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('adapter-bun', TS_AUTH_DB);
    });

    it('uses the configured port', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { port: 3000 } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('ts-port', TS_AUTH_DB);
    });

    it('uses the configured skipLoadEnv', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { skipLoadEnv: true } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('ts-skip-load-env', TS_AUTH_DB);
    });

    it('uses the configured outDir', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { outDir: 'dist' } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('ts-out-dir', TS_AUTH_DB, 'dist');
    });

    it('lets command-line flags override the configured values', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { output: 'cjs' } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--output', 'esm'], { from: 'user' }));

      expectServer('esm-auth-db', JS_AUTH_DB);
    });

    it('refuses an output dir that resolves to the non-empty project root', async () => {
      await setupProject({ withAuth: true, withDb: true });

      await expect(withCwd(tmp.path, () => generateServer.parseAsync(['--out-dir', '..'], { from: 'user' }))).rejects.toThrow('Refusing to replace');

      expect(tmp.exists('src/index.ts')).toBe(false);
      expect(tmp.exists('typebase/actions')).toBe(true);
    });
  });

  describe('regeneration after the source changes', () => {
    it('reflects edits to a source action', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('ts-auth-db', TS_AUTH_DB);

      const action = tmp.read('typebase/actions/queries/todos.ts');

      tmp.write('typebase/actions/queries/todos.ts', `${action}\n// EDITED MARKER\n`);

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_server/src/actions/queries/todos.ts')).toContain('EDITED MARKER');
    });

    it('picks up newly added actions', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      tmp.write('typebase/actions/queries/extra.ts', tmp.read('typebase/actions/queries/todos.ts'));

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(tmp.exists('typebase/_server/src/actions/queries/extra.ts')).toBe(true);
    });

    it('preserves .env and node_modules across regenerations', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      tmp.write('typebase/_server/.env', 'DATABASE_URL=postgres://localhost/db');
      tmp.write('typebase/_server/node_modules/some-dep/index.js', 'module.exports = {};');

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(tmp.read('typebase/_server/.env')).toBe('DATABASE_URL=postgres://localhost/db');
      expect(tmp.exists('typebase/_server/node_modules/some-dep/index.js')).toBe(true);
    });

    it('removes previously generated files when their source is removed (output dir is replaced, not merged)', async () => {
      await setupProject({ withAuth: true, withDb: true });

      tmp.write('typebase/actions/queries/extra.ts', tmp.read('typebase/actions/queries/todos.ts'));

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(tmp.exists('typebase/_server/src/actions/queries/extra.ts')).toBe(true);

      fs.rmSync(path.join(tmp.path, 'typebase/actions/queries/extra.ts'));

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(tmp.exists('typebase/_server/src/actions/queries/extra.ts')).toBe(false);
      expect(tmp.exists('typebase/_server/src/actions/queries/todos.ts')).toBe(true);
    });

    it('adds the auth server file when auth is introduced', async () => {
      await setupProject({ withAuth: false, withDb: true });

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));
      expect(tmp.exists('typebase/_server/src/auth.ts')).toBe(false);

      const authFile = `import { defineAuth } from "typebase-io/server";

export const auth = defineAuth({
  trustedOrigins: ["http://localhost:3000"],
  emailAndPassword: { enabled: true },
});
`;

      tmp.write('typebase/auth.ts', authFile);

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(tmp.exists('typebase/_server/src/auth.ts')).toBe(true);
      expect(tmp.read('typebase/_server/src/index.ts')).toContain('better-auth');
    });
  });

  describe('failures', () => {
    it('type-checks before generating and writes nothing when validation fails', async () => {
      vi.mocked(validateTypes).mockImplementationOnce(() => {
        throw new Error('Type checking failed.');
      });

      await setupProject({ withAuth: true, withDb: true });
      await expect(withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }))).rejects.toThrow('Type checking failed.');

      expect(tmp.exists('typebase/_server')).toBe(false);
    });

    it('keeps the previously generated output when a generator fails mid-run', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(tmp.exists('typebase/_server')).toBe(true);

      vi.mocked(generatePackageJson).mockRejectedValueOnce(new Error('boom'));

      await expect(withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }))).rejects.toThrow('boom');

      expect(tmp.exists('typebase/_server/src/index.ts')).toBe(true);
      expect(tmp.exists('typebase/_server/package.json')).toBe(true);
    });

    it('refuses to replace a non-empty directory that was not generated by typebase', async () => {
      await setupProject({ withAuth: true, withDb: true });

      tmp.write('important/notes.txt', 'do not delete');

      await expect(withCwd(tmp.path, () => generateServer.parseAsync(['--out-dir', '../important'], { from: 'user' }))).rejects.toThrow(
        'Refusing to replace'
      );

      expect(tmp.read('important/notes.txt')).toBe('do not delete');
    });

    it('reports the absolute path when the server is generated into the current directory', async () => {
      await setupProject({ withAuth: true, withDb: true });

      tmp.write('package.json', JSON.stringify({ name: '@typebase-io/server' }));

      await withCwd(tmp.path, () => generateServer.parseAsync(['--out-dir', '..'], { from: 'user' }));

      expect(succeeded()).toContain(`Server files generated in \`${tmp.path}\`.`);
    });

    it('rejects an invalid --port value', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);

      vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      await setupProject({ withAuth: true, withDb: true });
      await expect(withCwd(tmp.path, () => generateServer.parseAsync(['--port', 'abc'], { from: 'user' }))).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(tmp.exists('typebase/_server')).toBe(false);
    });

    it('rejects an invalid --output choice', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);

      vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      await setupProject({ withAuth: true, withDb: true });
      await expect(withCwd(tmp.path, () => generateServer.parseAsync(['--output', 'xml'], { from: 'user' }))).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
