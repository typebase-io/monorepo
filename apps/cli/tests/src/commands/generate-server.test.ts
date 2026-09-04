import fs from 'node:fs';
import path from 'node:path';

import * as dotenv from 'dotenv';
import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '#commands/db.ts';
import { generateServer } from '#commands/generate-server.ts';

import { generatePackageJson } from '#helpers/generate-server/generate-package-json.ts';
import { watchServer } from '#helpers/generate-server/watch-server.ts';
import { runUntilStopped } from '#helpers/shared/run-until-stopped.ts';
import { validateTypes } from '#helpers/shared/validate-types.ts';

import { expectProject } from '#tests/helpers/expect-project.ts';
import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkBetterAuth } from '#tests/helpers/link-better-auth.ts';
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

vi.mock('#helpers/shared/validate-types.ts', () => ({ validateTypes: vi.fn() }));
vi.mock('#helpers/generate-server/watch-server.ts', () => ({ watchServer: vi.fn() }));
vi.mock('#helpers/shared/run-until-stopped.ts', () => ({ runUntilStopped: vi.fn() }));
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
  'src/env.ts',
  'src/index.ts',
  'src/server.ts',
  'tsconfig.json',
  'typebase-server.json',
];

const JS_AUTH_DB = TS_AUTH_DB.filter((f) => f !== 'tsconfig.json').map((f) => (f.endsWith('.ts') ? f.replace(/\.ts$/, '.js') : f));
const TS_DB_ONLY = TS_AUTH_DB.filter((f) => f !== 'src/auth.ts' && f !== 'src/actions/custom-actions.ts');
const TS_BARE = TS_AUTH_DB.filter(
  (f) => !f.startsWith('src/db/') && f !== 'src/auth.ts' && f !== 'src/actions/custom-actions.ts' && f !== 'src/env.ts'
);

const TS_EMBEDDED_AUTH_DB = TS_AUTH_DB.filter((f) => f !== 'package.json' && f !== 'src/index.ts' && f !== 'tsconfig.json');
const TS_EMBEDDED_DB_ONLY = TS_DB_ONLY.filter((f) => f !== 'package.json' && f !== 'src/index.ts' && f !== 'tsconfig.json');
const JS_EMBEDDED_AUTH_DB = JS_AUTH_DB.filter((f) => f !== 'package.json' && f !== 'src/index.js');

const runPrompt = <T>(ask: () => Promise<T>) => ask();

const withoutCliVersion = (contents: string) => contents.replace(/"cliVersion": "[^"]*"/, '"cliVersion": "<version>"');

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

  const started = () => vi.mocked(ora).mock.calls.flat().map(String).join('\n');

  const warned = () => vi.mocked(ora()).warn.mock.calls.flat().map(String).join('\n');

  it('reports the dependencies, environment, cross-origin policy, and mount for an embedded server', async () => {
    await setupProject({ withAuth: true, withDb: true });
    tmp.write('typebase/package.json', JSON.stringify({ dependencies: { 'typebase-io': '0.1.0', pg: '^8.0.0' } }));

    await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded'], { from: 'user' }));

    expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('generate-server', 'host-requirements', 'node.txt');
    expect(vi.mocked(ora()).succeed.mock.calls.at(-1)).toEqual(['Server files generated in `typebase/_handler`.']);
    expect(vi.mocked(ora()).succeed.mock.invocationCallOrder.at(-1)).toBeLessThan(vi.mocked(console.log).mock.invocationCallOrder[0] ?? 0);
  });

  it.each(['fastify', 'hono', 'bun', 'deno', 'cloudflare'])('reports the mount for an embedded %s server', async (adapter) => {
    await setupProject({ withAuth: true, withDb: true });
    tmp.write('typebase/package.json', JSON.stringify({ dependencies: { 'typebase-io': '0.1.0', pg: '^8.0.0' } }));

    await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', '--adapter', adapter], { from: 'user' }));

    expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('generate-server', 'host-requirements', `${adapter}.txt`);
  });

  it('reports Typebase directory imports missing from a separate host package and custom environment keys', async () => {
    await setupProject({ withAuth: false, withDb: true });
    tmp.write('typebase/package.json', JSON.stringify({ dependencies: { 'typebase-io': '0.1.0', zod: '^4.4.0' } }));
    tmp.write('host/package.json', JSON.stringify({ dependencies: { pg: '^8', 'drizzle-orm': '^1.0.0-beta.22' } }));
    tmp.write(
      'typebase/env.ts',
      `import { defineEnv } from "typebase-io/server";
import { z } from "zod";
export const env = defineEnv({ MAIL_API_KEY: z.string() });`
    );
    tmp.write('pnpm-lock.yaml', '');
    tmp.write('host/bun.lock', '');

    await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', '--out-dir', '../host/src/typebase'], { from: 'user' }));

    expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('generate-server', 'host-requirements', 'workspace.txt');
    expect(withoutCliVersion(tmp.read('host/src/typebase/typebase-server.json'))).toEqualTemplate(
      'generate-server',
      'host-requirements',
      'workspace-marker.json.txt'
    );
  });

  it('warns when a host dependency excludes the version the embedded server needs', async () => {
    await setupProject({ withAuth: false, withDb: true });
    tmp.write('typebase/package.json', JSON.stringify({ dependencies: { 'typebase-io': '0.1.0', pg: '^7.0.0' } }));

    await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded'], { from: 'user' }));

    expect(warned()).toContain('Host dependency `pg@^7.0.0` does not include the generated server requirement `8.20.0`');
  });

  it.each(['8.20.0', '^8.0.0', '~8.20.0', '8.x', '>=8 <9', '^7 || ^8'])('accepts the host dependency range %s', async (version) => {
    await setupProject({ withAuth: false, withDb: true });
    tmp.write('typebase/package.json', JSON.stringify({ dependencies: { 'typebase-io': '0.1.0', pg: version } }));

    await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded'], { from: 'user' }));

    expect(warned()).not.toContain('`pg@');
  });

  it.each(['workspace:*', 'file:../pg', 'latest'])('warns without failing when %s cannot be validated as semver', async (version) => {
    await setupProject({ withAuth: false, withDb: true });
    tmp.write('typebase/package.json', JSON.stringify({ dependencies: { 'typebase-io': '0.1.0', pg: version } }));

    await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded'], { from: 'user' }));

    expect(warned()).toContain(`Cannot validate host dependency \`pg@${version}\``);
  });

  it('requires a host range to opt into a prerelease dependency', async () => {
    await setupProject({ withAuth: false, withDb: true });
    tmp.write('typebase/package.json', JSON.stringify({ dependencies: { 'typebase-io': '0.1.0', 'drizzle-orm': '*' } }));

    await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded'], { from: 'user' }));

    expect(warned()).toContain('Host dependency `drizzle-orm@*` does not include the generated server requirement `1.0.0-beta.22`');
  });

  it('checks the manifest of the application mounting the output, including development and optional dependencies', async () => {
    await setupProject({ withAuth: false, withDb: true });
    tmp.write('host/package.json', JSON.stringify({ devDependencies: { pg: '^8.0.0' }, optionalDependencies: { 'drizzle-orm': '^1.0.0-beta.22' } }));

    await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', '--out-dir', '../host/src/typebase'], { from: 'user' }));

    expect(warned()).not.toContain('`pg@');
    expect(warned()).not.toContain('`drizzle-orm@');
    expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('generate-server', 'host-requirements', 'external-host.txt');
  });

  it('does not validate host dependencies for a standalone server', async () => {
    await setupProject({ withAuth: false, withDb: true });
    tmp.write('typebase/package.json', JSON.stringify({ dependencies: { 'typebase-io': '0.1.0', pg: '^7' } }));

    await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

    expect(warned()).toBe('');
    expect(vi.mocked(console.log).mock.calls).toEqual([]);
  });

  it('still generates an embedded server when its destination has no host manifest yet', async () => {
    await setupProject({ withAuth: false, withDb: true });

    await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', '--out-dir', '../host/src/typebase'], { from: 'user' }));

    expect(tmp.read('host/src/typebase/src/server.ts')).toEqualTemplate('generate-server', 'embedded-node-db-only', 'src', 'server.ts.txt');
    expect(warned()).toContain('Cannot validate host dependencies: no package.json was found');
  });

  describe('--watch', () => {
    const typebaseDirPath = () => path.join(tmp.path, 'typebase');

    const watchOptions = () => vi.mocked(watchServer).mock.calls[0]?.[0];

    beforeEach(() => {
      vi.mocked(runUntilStopped).mockImplementation((run) => run(new AbortController().signal, runPrompt));
    });

    it('reports embedded host requirements and warnings on the first build only', async () => {
      await setupProject({ withAuth: true, withDb: true });
      tmp.write('typebase/package.json', JSON.stringify({ dependencies: { 'typebase-io': '0.1.0', pg: '^7.0.0' } }));
      await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', '--watch'], { from: 'user' }));
      await withCwd(tmp.path, () => watchOptions()?.build(new AbortController().signal, { rebuild: false }));
      expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('generate-server', 'host-requirements', 'mismatched-host.txt');
      expect(warned()).toContain('Host dependency `pg@^7.0.0` does not include');
      vi.mocked(ora()).warn.mockClear();
      vi.mocked(console.log).mockClear();

      await withCwd(tmp.path, () => watchOptions()?.build(new AbortController().signal, { rebuild: true }));

      expect(warned()).toBe('');
      expect(vi.mocked(console.log).mock.calls).toEqual([]);
    });

    it('does not watch unless asked to', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(watchServer).not.toHaveBeenCalled();
      expect(runUntilStopped).not.toHaveBeenCalled();
    });

    it('watches the typebase directory, stoppable like `logs`', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--watch'], { from: 'user' }));

      expect(runUntilStopped).toHaveBeenCalledOnce();
      expect(watchOptions()?.dirPath).toBe(typebaseDirPath());
      expect(watchOptions()?.signal).toBeInstanceOf(AbortSignal);
    });

    it('ignores the directories generation writes to, so a build cannot retrigger itself', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--watch'], { from: 'user' }));

      expect(watchOptions()?.ignoredDirPaths).toEqual(
        expect.arrayContaining([path.join(typebaseDirPath(), '_server'), path.join(typebaseDirPath(), '_generated')])
      );
    });

    it('ignores a custom output directory', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--watch', '--out-dir', 'dist'], { from: 'user' }));

      expect(watchOptions()?.ignoredDirPaths).toEqual(expect.arrayContaining([path.join(typebaseDirPath(), 'dist')]));
    });

    it('does not also ignore the configured output directory that `--out-dir` replaced', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { outDir: '.' } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--watch', '--out-dir', 'dist'], { from: 'user' }));

      expect(watchOptions()?.ignoredDirPaths).toContain(path.join(typebaseDirPath(), 'dist'));
      expect(watchOptions()?.ignoredDirPaths).not.toContain(typebaseDirPath());
    });

    it('builds the same server on every rebuild', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--watch'], { from: 'user' }));

      await withCwd(tmp.path, () => watchOptions()?.build(new AbortController().signal, { rebuild: true }));

      expectServer('ts-auth-db', TS_AUTH_DB);
    });

    it('narrates every step of the first build', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--watch'], { from: 'user' }));

      await withCwd(tmp.path, () => watchOptions()?.build(new AbortController().signal, { rebuild: false }));

      expect(started()).toContain('Generating types...');
      expect(started()).toContain('Generating server files...');
      expect(succeeded()).toContain('Server files generated in');
      expect(started()).not.toContain('Regenerating...');
    });

    it('reports a rebuild as a single line instead of repeating every step', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--watch'], { from: 'user' }));

      vi.mocked(ora).mockClear();
      vi.mocked(ora()).succeed.mockClear();

      await withCwd(tmp.path, () => watchOptions()?.build(new AbortController().signal, { rebuild: true }));

      expect(started()).toContain('Regenerating...');
      expect(succeeded()).toContain('Server regenerated!');

      expect(started()).not.toContain('Generating types...');
      expect(started()).not.toContain('Type-checking');
      expect(started()).not.toContain('Generating server files...');
      expect(succeeded()).not.toContain('Server files generated in');
    });
  });

  const expectServer = (outcome: string, files: string[], root = '_server') => {
    expectProject(tmp, outcome, files, { namespace: 'generate-server', root: `typebase/${root}`, normalise: withoutCliVersion });
  };

  describe('generates the expected project for each flag combination', () => {
    const cases = [
      { name: 'ts-auth-db', withAuth: true, withDb: true, args: [] as string[], files: TS_AUTH_DB, root: '_server' },
      { name: 'esm-auth-db', withAuth: true, withDb: true, args: ['--output', 'esm'], files: JS_AUTH_DB, root: '_server' },
      { name: 'cjs-auth-db', withAuth: true, withDb: true, args: ['--output', 'cjs'], files: JS_AUTH_DB, root: '_server' },
      { name: 'ts-db-only', withAuth: false, withDb: true, args: [], files: TS_DB_ONLY, root: '_server' },
      { name: 'ts-bare', withAuth: false, withDb: false, args: [], files: TS_BARE, root: '_server' },
      { name: 'ts-port', withAuth: true, withDb: true, args: ['--port', '3000'], files: TS_AUTH_DB, root: '_server' },
      { name: 'ts-out-dir', withAuth: true, withDb: true, args: ['--out-dir', 'dist'], files: TS_AUTH_DB, root: 'dist' },
      { name: 'embedded-node-auth-db', withAuth: true, withDb: true, args: ['--embedded'], files: TS_EMBEDDED_AUTH_DB, root: '_handler' },
      { name: 'embedded-node-db-only', withAuth: false, withDb: true, args: ['--embedded'], files: TS_EMBEDDED_DB_ONLY, root: '_handler' },
      {
        name: 'embedded-bun-auth-db',
        withAuth: true,
        withDb: true,
        args: ['--embedded', '--adapter', 'bun'],
        files: TS_EMBEDDED_AUTH_DB,
        root: '_handler',
      },
      {
        name: 'embedded-bun-db-only',
        withAuth: false,
        withDb: true,
        args: ['--embedded', '--adapter', 'bun'],
        files: TS_EMBEDDED_DB_ONLY,
        root: '_handler',
      },
      {
        name: 'embedded-cloudflare-auth-db',
        withAuth: true,
        withDb: true,
        args: ['--embedded', '--adapter', 'cloudflare'],
        files: TS_EMBEDDED_AUTH_DB,
        root: '_handler',
      },
      {
        name: 'embedded-cloudflare-db-only',
        withAuth: false,
        withDb: true,
        args: ['--embedded', '--adapter', 'cloudflare'],
        files: TS_EMBEDDED_DB_ONLY,
        root: '_handler',
      },
      {
        name: 'embedded-deno-auth-db',
        withAuth: true,
        withDb: true,
        args: ['--embedded', '--adapter', 'deno'],
        files: TS_EMBEDDED_AUTH_DB,
        root: '_handler',
      },
      {
        name: 'embedded-deno-db-only',
        withAuth: false,
        withDb: true,
        args: ['--embedded', '--adapter', 'deno'],
        files: TS_EMBEDDED_DB_ONLY,
        root: '_handler',
      },
      {
        name: 'embedded-fastify-auth-db',
        withAuth: true,
        withDb: true,
        args: ['--embedded', '--adapter', 'fastify'],
        files: TS_EMBEDDED_AUTH_DB,
        root: '_handler',
      },
      {
        name: 'embedded-fastify-db-only',
        withAuth: false,
        withDb: true,
        args: ['--embedded', '--adapter', 'fastify'],
        files: TS_EMBEDDED_DB_ONLY,
        root: '_handler',
      },
      {
        name: 'embedded-hono-auth-db',
        withAuth: true,
        withDb: true,
        args: ['--embedded', '--adapter', 'hono'],
        files: TS_EMBEDDED_AUTH_DB,
        root: '_handler',
      },
      {
        name: 'embedded-hono-db-only',
        withAuth: false,
        withDb: true,
        args: ['--embedded', '--adapter', 'hono'],
        files: TS_EMBEDDED_DB_ONLY,
        root: '_handler',
      },
      {
        name: 'embedded-custom-paths',
        withAuth: true,
        withDb: true,
        args: ['--embedded', '--actions-path', '/typebase/rpc', '--auth-path', '/typebase/auth'],
        files: TS_EMBEDDED_AUTH_DB,
        root: '_handler',
      },
      {
        name: 'embedded-esm-auth-db',
        withAuth: true,
        withDb: true,
        args: ['--embedded', '--output', 'esm'],
        files: JS_EMBEDDED_AUTH_DB,
        root: '_handler',
      },
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

    it('writes an embedded server to the output directory it was given', async () => {
      await setupProject({ withAuth: false, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', '--out-dir', 'dist'], { from: 'user' }));

      expectServer('embedded-node-db-only', TS_EMBEDDED_DB_ONLY, 'dist');
    });
  });

  it.each(['ts', 'esm', 'cjs'] as const)('gives the %s server its own pnpm workspace, so installing there stays inside it', async (output) => {
    await setupProject({ withAuth: true, withDb: true });

    tmp.write('pnpm-lock.yaml', '');

    await withCwd(tmp.path, () => generateServer.parseAsync(['--output', output], { from: 'user' }));

    expect(tmp.read('typebase/_server/pnpm-workspace.yaml')).toEqualTemplate('generate-package-manager-config', 'pnpm-workspace.yaml.txt');
  });

  it('refuses to build a project that has auth but no database schema', async () => {
    await setupProject({ withAuth: true, withDb: false });

    await expect(withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }))).rejects.toThrow(
      'Found `auth.ts` but no database schema at `db/schema.ts`'
    );

    expect(fs.existsSync(path.join(tmp.path, 'typebase/_server'))).toBe(false);
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

    it('uses the configured outDir', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { outDir: 'dist' } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('ts-out-dir', TS_AUTH_DB, 'dist');
    });

    it('uses the configured mode, and the default output directory that mode brings with it', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { embedded: true } }));

      await setupProject({ withAuth: false, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('embedded-node-db-only', TS_EMBEDDED_DB_ONLY, '_handler');
    });

    it('uses the configured outDir in embedded mode', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { embedded: true, outDir: 'dist' } }));

      await setupProject({ withAuth: false, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('embedded-node-db-only', TS_EMBEDDED_DB_ONLY, 'dist');
    });

    it.each(['', '/', '///'])('uses the configured paths in embedded mode with trailing slashes %j', async (trailingSlashes) => {
      tmp.write(
        'typebase.json',
        JSON.stringify({ server: { embedded: true, actionsPath: `/typebase/rpc${trailingSlashes}`, authPath: `/typebase/auth${trailingSlashes}` } })
      );

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('embedded-custom-paths', TS_EMBEDDED_AUTH_DB, '_handler');
    });

    it('ignores configured paths in standalone mode instead of refusing to run', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { actionsPath: '/typebase/rpc', authPath: '/typebase/auth' } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('ts-auth-db', TS_AUTH_DB);
    });

    it('ignores a configured port in embedded mode instead of refusing to run', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { embedded: true, port: 3000 } }));

      await setupProject({ withAuth: false, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expectServer('embedded-node-db-only', TS_EMBEDDED_DB_ONLY, '_handler');
    });

    it('lets command-line flags override the configured values', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { output: 'cjs' } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--output', 'esm'], { from: 'user' }));

      expectServer('esm-auth-db', JS_AUTH_DB);
    });

    it('lets the embedded flag override a disabled embedded setting', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { embedded: false } }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded'], { from: 'user' }));

      expectServer('embedded-node-auth-db', TS_EMBEDDED_AUTH_DB, '_handler');
    });

    it('refuses an output dir that contains the typebase directory', async () => {
      await setupProject({ withAuth: true, withDb: true });

      await expect(withCwd(tmp.path, () => generateServer.parseAsync(['--out-dir', '..'], { from: 'user' }))).rejects.toThrow(
        'contains your typebase directory'
      );

      expect(tmp.exists('src/index.ts')).toBe(false);
      expect(tmp.exists('typebase/actions')).toBe(true);
    });

    it('refuses even when the containing directory looks like a previously generated server', async () => {
      await setupProject({ withAuth: true, withDb: true });

      tmp.write('package.json', JSON.stringify({ name: '@typebase-io/server' }));

      await expect(withCwd(tmp.path, () => generateServer.parseAsync(['--out-dir', '..'], { from: 'user' }))).rejects.toThrow(
        'contains your typebase directory'
      );

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

      expect(tmp.read('typebase/_server/src/actions/queries/todos.ts')).toEqualTemplate('generate-server', 'edited-action', 'todos.ts.txt');
    });

    it('picks up newly added actions', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      tmp.write('typebase/actions/queries/extra.ts', tmp.read('typebase/actions/queries/todos.ts'));

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(tmp.exists('typebase/_server/src/actions/queries/extra.ts')).toBe(true);
    });

    it('copies the keys the generated server validates out of the project env file, and says which', async () => {
      await setupProject({ withAuth: true, withDb: true });

      tmp.write('.env', ['DATABASE_URL=postgres://project/database', 'BETTER_AUTH_SECRET=already-chosen', 'VERCEL_TOKEN=vercel-token'].join('\n'));

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      const serverEnv = dotenv.parse(tmp.read('typebase/_server/.env'));

      expect(serverEnv.DATABASE_URL).toBe('postgres://project/database');
      expect(serverEnv.BETTER_AUTH_SECRET).toBe('already-chosen');
      expect(serverEnv.VERCEL_TOKEN).toBeUndefined();
      expect(succeeded()).toContain('DATABASE_URL');
      expect(succeeded()).toContain('copied from your project `.env`.');
    });

    it('seeds no env file into an embedded output directory, so the fragment never becomes a place secrets accumulate', async () => {
      await setupProject({ withAuth: true, withDb: true });

      tmp.write('.env', ['DATABASE_URL=postgres://project/database', 'BETTER_AUTH_SECRET=already-chosen'].join('\n'));

      await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded'], { from: 'user' }));

      expect(tmp.exists('typebase/_handler/.env')).toBe(false);
      expect(succeeded()).not.toContain('copied from your project');
    });

    it('says nothing about copying when the project env file holds none of those keys', async () => {
      await setupProject({ withAuth: true, withDb: true });

      tmp.write('.env', 'VERCEL_TOKEN=vercel-token');

      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(succeeded()).not.toContain('copied from your project');
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

    it.each([
      { property: 'basePath', fixture: 'developer-base-path' },
      { property: '"basePath"', fixture: 'developer-base-path-double-quoted' },
      { property: "'basePath'", fixture: 'developer-base-path-single-quoted' },
    ])('follows a $property the developer set in their own auth file, and says so', async ({ property, fixture }) => {
      await setupProject({ withAuth: true, withDb: true });

      const authFile = `import { defineAuth } from "typebase-io/server";

export const auth = defineAuth({
  ${property}: "/mine",
  emailAndPassword: { enabled: true },
});
`;

      tmp.write('typebase/auth.ts', authFile);

      await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', '--auth-path', '/typebase/auth'], { from: 'user' }));

      expect(warned()).toContain('`auth.ts` sets `basePath: "/mine"`');
      expect(warned()).toContain('rather than at `/typebase/auth`');

      expect(tmp.read('typebase/_handler/src/auth.ts')).toEqualTemplate('generate-server', fixture, 'src', 'auth.ts.txt');
      expect(tmp.read('typebase/_handler/src/server.ts')).toEqualTemplate('generate-server', 'developer-base-path', 'src', 'server.ts.txt');
    });

    it.each(['node', 'bun', 'cloudflare', 'deno', 'fastify', 'hono'])(
      'keeps a dynamic auth base path and the %s route in agreement',
      async (adapter) => {
        await setupProject({ withAuth: true, withDb: true });
        tmp.write(
          'typebase/auth.ts',
          `import { defineAuth } from 'typebase-io/server';
export const auth = defineAuth({ basePath: process.env.AUTH_PATH || '/mine' });`
        );

        await withCwd(tmp.path, () =>
          generateServer.parseAsync(['--embedded', '--adapter', adapter, '--auth-path', '/configured'], { from: 'user' })
        );

        expect(tmp.read('typebase/_handler/src/auth.ts')).toEqualTemplate('generate-server', 'dynamic-auth-path', 'auth.ts.txt');
        expect(tmp.read('typebase/_handler/src/server.ts')).toEqualTemplate('generate-server', 'dynamic-auth-path', adapter, 'server.ts.txt');
        expect(warned()).toContain('the generated auth route follows its runtime value');
      }
    );

    it('escapes custom paths in the actions prefix and both route registrations', async () => {
      await setupProject({ withAuth: true, withDb: true });

      await withCwd(tmp.path, () =>
        generateServer.parseAsync(['--embedded', '--adapter', 'hono', '--actions-path', '/my"actions', '--auth-path', '/my"auth'], {
          from: 'user',
        })
      );

      expect(tmp.read('typebase/_handler/src/server.ts')).toEqualTemplate('generate-server', 'escaped-paths', 'server.ts.txt');
      expect(tmp.read('typebase/_handler/src/auth.ts')).toEqualTemplate('generate-server', 'escaped-paths', 'auth.ts.txt');
    });

    it('exposes the default base path when auth options are spread without an explicit path', async () => {
      await setupProject({ withAuth: true, withDb: true });
      tmp.write(
        'typebase/auth.ts',
        `import { defineAuth } from 'typebase-io/server';
const options = { emailAndPassword: { enabled: true } };
export const auth = defineAuth({ ...options });`
      );

      await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded'], { from: 'user' }));

      expect(tmp.read('typebase/_handler/src/auth.ts')).toEqualTemplate('generate-server', 'spread-auth-default', 'auth.ts.txt');
      expect(tmp.read('typebase/_handler/src/server.ts')).toEqualTemplate('generate-server', 'dynamic-auth-path', 'node', 'server.ts.txt');
    });

    it.each([
      { properties: "['basePath']: '/mine'", fixture: 'computed-auth-literal' },
      { properties: "[key]: '/mine'", fixture: 'computed-auth-key' },
      { properties: '...options', fixture: 'spread-auth-override' },
    ])('follows auth overrides supplied as $properties', async ({ properties, fixture }) => {
      await setupProject({ withAuth: true, withDb: true });
      tmp.write(
        'typebase/auth.ts',
        `import { defineAuth } from 'typebase-io/server';
const key = 'basePath';
const options = { basePath: '/mine' };
export const auth = defineAuth({ ${properties} });`
      );

      await withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', '--auth-path', '/configured'], { from: 'user' }));

      expect(tmp.read('typebase/_handler/src/auth.ts')).toEqualTemplate('generate-server', fixture, 'auth.ts.txt');
      expect(tmp.read('typebase/_handler/src/server.ts')).toEqualTemplate('generate-server', 'dynamic-auth-path', 'node', 'server.ts.txt');
      expect(warned()).toContain('the generated auth route follows its runtime value');
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
      expect(tmp.read('typebase/_server/src/server.ts')).toEqualTemplate('generate-server', 'auth-introduced', 'src', 'server.ts.txt');
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

    it('reports the absolute path when the output directory is the current directory', async () => {
      await setupProject({ withAuth: true, withDb: true });

      const outDirPath = tmp.mkdir('out');

      tmp.write('out/typebase.json', JSON.stringify({ projectPath: '../typebase', server: { outDir: '../out' } }));
      tmp.write('out/package.json', JSON.stringify({ name: '@typebase-io/server' }));

      await withCwd(outDirPath, () => generateServer.parseAsync([], { from: 'user' }));

      expect(succeeded()).toContain(`Server files generated in \`${outDirPath}\`.`);
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

    it.each(['--actions-path', '--auth-path'])('rejects %s passed alongside a standalone server, which serves fixed paths', async (flag) => {
      await setupProject({ withAuth: true, withDb: true });

      await expect(withCwd(tmp.path, () => generateServer.parseAsync([flag, '/typebase/rpc'], { from: 'user' }))).rejects.toThrow(
        'a standalone server owns its process and always serves the paths it was built with'
      );

      expect(tmp.exists('typebase/_server')).toBe(false);
    });

    it.each([
      ['--actions-path', '/api/rpc', '--auth-path', '/api'],
      ['--actions-path', '/rpc', '--auth-path', '/rpc'],
      ['--actions-path', '/rpc', '--auth-path', '/'],
    ])('rejects an auth path that would answer every action request: %j', async (...args) => {
      await setupProject({ withAuth: true, withDb: true });

      await expect(withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', ...args], { from: 'user' }))).rejects.toThrow(
        'the generated server matches the auth path before your actions'
      );

      expect(tmp.exists('typebase/_handler')).toBe(false);
    });

    it.each([
      ['--embedded', '--port', '3000'],
      ['--port', '3000', '--embedded'],
    ])('rejects conflicting embedded and port flags: %j', async (...args) => {
      vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);

      const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      await expect(withCwd(tmp.path, () => generateServer.parseAsync(args, { from: 'user' }))).rejects.toThrow('process.exit called');

      expect(stderr.mock.calls.flat().join('')).toBe("error: option '--port <number>' cannot be used with option '--embedded'\n");
      expect(tmp.exists('typebase/_handler')).toBe(false);
    });

    it('rejects an explicit port when embedded is enabled in configuration', async () => {
      tmp.write('typebase.json', JSON.stringify({ server: { embedded: true } }));

      await expect(withCwd(tmp.path, () => generateServer.parseAsync(['--port', '3000'], { from: 'user' }))).rejects.toThrow(
        'an embedded server is mounted by your application and never listens'
      );

      expect(tmp.exists('typebase/_handler')).toBe(false);
    });

    it.each([
      { outDir: '.', reason: 'contains your typebase directory' },
      { outDir: 'actions/handler', reason: 'inside `actions/`' },
      { outDir: 'db/handler', reason: 'inside `db/`' },
    ])('refuses an embedded output dir at $outDir', async ({ outDir, reason }) => {
      await setupProject({ withAuth: false, withDb: true });

      await expect(withCwd(tmp.path, () => generateServer.parseAsync(['--embedded', '--out-dir', outDir], { from: 'user' }))).rejects.toThrow(reason);

      expect(tmp.exists('typebase/actions/queries/todos.ts')).toBe(true);
      expect(tmp.exists('typebase/db/schema.ts')).toBe(true);
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

  describe('in migrations mode', () => {
    const MIGRATION = '20260101000000_initial';

    const withoutIds = (contents: string) =>
      contents.replaceAll(/(?!00000000-0000-0000-0000-000000000000)[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/g, '<uuid>');

    const TS_MIGRATIONS = [
      'package.json',
      'src/_generated/server.ts',
      'src/actions/mutations/todos.ts',
      'src/actions/queries/todos.ts',
      'src/db/drizzle.config.ts',
      'src/db/index.ts',
      `src/db/migrations/${MIGRATION}/migration.sql`,
      `src/db/migrations/${MIGRATION}/snapshot.json`,
      'src/db/relations.ts',
      'src/db/schema.ts',
      'src/env.ts',
      'src/index.ts',
      'src/server.ts',
      'tsconfig.json',
      'typebase-server.json',
    ];

    const JS_MIGRATIONS = TS_MIGRATIONS.filter((file) => file !== 'tsconfig.json').map((file) =>
      file.endsWith('.ts') ? file.replace(/\.ts$/, '.js') : file
    );

    beforeEach(async () => {
      await setupProject({ withAuth: false, withDb: true });

      tmp.mkdir('typebase/db/migrations');

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      await withCwd(tmp.path, () => db.parseAsync(['migrations', 'generate', '--name', 'initial'], { from: 'user' }));

      vi.useRealTimers();
    });

    it.each([
      { outcome: 'ts-migrations', args: [] as string[], files: TS_MIGRATIONS },
      { outcome: 'esm-migrations', args: ['--output', 'esm'], files: JS_MIGRATIONS },
      { outcome: 'cjs-migrations', args: ['--output', 'cjs'], files: JS_MIGRATIONS },
    ])('generates $outcome with the migrations alongside the schema', async ({ outcome, args, files }) => {
      await withCwd(tmp.path, () => generateServer.parseAsync(args, { from: 'user' }));

      expectProject(tmp, outcome, files, {
        namespace: 'generate-server',
        root: 'typebase/_server',
        normalise: (contents) => withoutCliVersion(withoutIds(contents)),
      });
    });
  });

  describe('in push mode', () => {
    it('generates a server with no migrations folder', async () => {
      await setupProject({ withAuth: false, withDb: true });

      await withCwd(tmp.path, () => generateServer.parseAsync(['--output', 'esm'], { from: 'user' }));

      expect(listFiles(path.join(tmp.path, 'typebase/_server')).filter((file) => file.includes('migrations'))).toEqual([]);
    });
  });

  describe('--command', () => {
    const marker = () => path.join(tmp.path, 'ran.txt');

    const markerArg = () => `'${marker()}'`;

    const readMarker = () => (fs.existsSync(marker()) ? fs.readFileSync(marker(), 'utf8') : '');

    const until = async (predicate: () => boolean, label: string) => {
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        if (predicate()) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      throw new Error(`Timed out waiting for ${label}.`);
    };

    beforeEach(async () => {
      await setupProject({ withAuth: false, withDb: true });

      vi.mocked(runUntilStopped).mockImplementation((run) => run(new AbortController().signal, runPrompt));
    });

    it('runs the command in the generated server once it exists', async () => {
      await withCwd(tmp.path, () =>
        generateServer.parseAsync(['--command', `node -e "require('fs').writeFileSync(${markerArg()}, String(require('fs').existsSync('src')))"`], {
          from: 'user',
        })
      );

      expect(readMarker()).toBe('true');
    });

    it('waits for the command to finish before returning', async () => {
      await withCwd(tmp.path, () =>
        generateServer.parseAsync(['--command', `node -e "setTimeout(() => require('fs').writeFileSync(${markerArg()}, 'late'), 150)"`], {
          from: 'user',
        })
      );

      expect(readMarker()).toBe('late');
    });

    it('stops the command when the run is stopped, so nothing is left holding the port', async () => {
      const controller = new AbortController();

      vi.mocked(runUntilStopped).mockImplementation((run) => {
        setTimeout(() => {
          controller.abort();
        }, 300);

        return run(controller.signal, runPrompt);
      });

      await withCwd(tmp.path, () =>
        generateServer.parseAsync(
          ['--command', `true && node -e "require('fs').writeFileSync(${markerArg()}, String(process.pid)); setInterval(() => {}, 1000)"`],
          { from: 'user' }
        )
      );

      const pid = Number(readMarker());

      expect(pid).toBeGreaterThan(0);

      await until(() => {
        try {
          process.kill(pid, 0);

          return false;
        } catch {
          return true;
        }
      }, 'the command to be gone');
    });

    it('generates as usual when no command is passed', async () => {
      await withCwd(tmp.path, () => generateServer.parseAsync([], { from: 'user' }));

      expect(fs.existsSync(path.join(tmp.path, 'typebase/_server/src/index.ts'))).toBe(true);
      expect(readMarker()).toBe('');
    });

    it('keeps watching after a command that failed, and runs it again on the next change', async () => {
      vi.mocked(runUntilStopped).mockImplementation((run) => run(new AbortController().signal, runPrompt));

      vi.mocked(watchServer).mockImplementation(async ({ build }) => {
        await build(new AbortController().signal, { rebuild: false });

        await until(() => readMarker().trim().split('\n').filter(Boolean).length === 1, 'the failing command to run');

        await build(new AbortController().signal, { rebuild: true });

        await until(() => readMarker().trim().split('\n').filter(Boolean).length === 2, 'it to run again');
      });

      await expect(
        withCwd(tmp.path, () =>
          generateServer.parseAsync(['--watch', '--command', `node -e "require('fs').appendFileSync(${markerArg()}, 'tried\\n'); process.exit(1)"`], {
            from: 'user',
          })
        )
      ).resolves.not.toThrow();

      expect(readMarker().trim().split('\n').filter(Boolean)).toEqual(['tried', 'tried']);
    });

    it('restarts the command on every rebuild, and leaves nothing running when the watch stops', async () => {
      vi.mocked(runUntilStopped).mockImplementation((run) => run(new AbortController().signal, runPrompt));

      vi.mocked(watchServer).mockImplementation(async ({ build }) => {
        await build(new AbortController().signal, { rebuild: false });

        await until(() => readMarker().trim().split('\n').filter(Boolean).length === 1, 'the first run');

        await build(new AbortController().signal, { rebuild: true });

        await until(() => readMarker().trim().split('\n').filter(Boolean).length === 2, 'the rebuild to restart it');
      });

      await withCwd(tmp.path, () =>
        generateServer.parseAsync(
          [
            '--watch',
            '--command',
            `true && node -e "const fs=require('fs'); fs.appendFileSync(${markerArg()}, process.pid + '\\n'); setInterval(() => {}, 1000)"`,
          ],
          { from: 'user' }
        )
      );

      const pids = readMarker()
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => Number(line));

      expect(pids).toHaveLength(2);

      await until(
        () =>
          pids.every((pid) => {
            try {
              process.kill(pid, 0);

              return false;
            } catch {
              return true;
            }
          }),
        'every run to be gone'
      );
    });
  });
});
