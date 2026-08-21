import fs from 'node:fs';
import path from 'node:path';

import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auth } from '#commands/auth.ts';
import { codegen } from '#commands/codegen.ts';
import { deploy } from '#commands/deploy.ts';

import { neon } from '#helpers/db/neon/index.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';
import { cloudflare } from '#helpers/deploy/cloudflare/index.ts';
import { deno } from '#helpers/deploy/deno/index.ts';
import { vercel } from '#helpers/deploy/vercel/index.ts';
import { getCloudflareEnvVar } from '#helpers/env/cloudflare.ts';
import { getDenoEnvVar } from '#helpers/env/deno.ts';
import { getVercelEnvVar } from '#helpers/env/vercel.ts';
import { generatePackageJson } from '#helpers/generate-server/generate-package-json.ts';
import { streamLogs } from '#helpers/logs/stream-logs.ts';
import * as ValidateTypes from '#helpers/shared/validate-types.ts';

import { expectProject } from '#tests/helpers/expect-project.ts';
import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkBetterAuth } from '#tests/helpers/link-better-auth.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { linkZod } from '#tests/helpers/link-zod.ts';
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
vi.mock('#helpers/db/neon/index.ts', () => ({ neon: vi.fn() }));
vi.mock('#helpers/db/push-schema.ts', () => ({ pushSchema: vi.fn() }));
vi.mock('#helpers/env/vercel.ts', () => ({ getVercelEnvVar: vi.fn() }));
vi.mock('#helpers/env/deno.ts', () => ({ getDenoEnvVar: vi.fn() }));
vi.mock('#helpers/env/cloudflare.ts', () => ({ getCloudflareEnvVar: vi.fn() }));
vi.mock('#helpers/deploy/vercel/index.ts', () => ({ vercel: vi.fn() }));
vi.mock('#helpers/deploy/deno/index.ts', () => ({ deno: vi.fn() }));
vi.mock('#helpers/deploy/cloudflare/index.ts', () => ({ cloudflare: vi.fn() }));
vi.mock('#helpers/logs/stream-logs.ts', () => ({ streamLogs: vi.fn() }));
vi.mock('#helpers/generate-server/generate-package-json.ts', async (o) => passThrough(await o<Record<string, unknown>>()));

const CONNECTION_URI = 'postgres://neon/db';
const DEPLOY_URL = 'https://app.example.com';

const JS_AUTH_DB = [
  'package.json',
  'src/_generated/server.js',
  'src/actions/custom-actions.js',
  'src/actions/mutations/todos.js',
  'src/actions/queries/todos.js',
  'src/auth.js',
  'src/db/drizzle.config.js',
  'src/db/index.js',
  'src/db/relations.js',
  'src/db/schema.js',
  'src/env.js',
  'src/index.js',
];

const JS_DB_ONLY = JS_AUTH_DB.filter((f) => f !== 'src/auth.js' && f !== 'src/actions/custom-actions.js');
const JS_PUBLISHER = [...JS_DB_ONLY, 'src/publisher.js'];
const JS_BARE = JS_AUTH_DB.filter(
  (f) => !f.startsWith('src/db/') && f !== 'src/auth.js' && f !== 'src/actions/custom-actions.js' && f !== 'src/env.js'
);

describe('deploy command', () => {
  let tmp: TempDir;
  let capturedEnv: { key: string; value: string; secret: boolean }[];

  beforeEach(() => {
    vi.clearAllMocks();

    delete process.env.BETTER_AUTH_SECRET;

    tmp = createTempDir();
    capturedEnv = [];

    linkTypebaseIo(tmp);
    linkBetterAuth(tmp);
    linkZod(tmp);

    vi.mocked(ValidateTypes.validateTypes).mockReset();
    vi.mocked(neon).mockResolvedValue({ projectId: 'proj-1', branchId: 'br-1', connectionUri: CONNECTION_URI });
    vi.mocked(pushSchema).mockResolvedValue(undefined);
    vi.mocked(getVercelEnvVar).mockResolvedValue(undefined);
    vi.mocked(getDenoEnvVar).mockResolvedValue(undefined);
    vi.mocked(getCloudflareEnvVar).mockResolvedValue(undefined);

    const impl = ({ serverDirPath, env }: { serverDirPath: string; env: { key: string; value: string; secret: boolean }[] }) => {
      capturedEnv = env;

      fs.cpSync(serverDirPath, path.join(tmp.path, 'captured'), { recursive: true });

      return Promise.resolve({ deploymentId: 'dep_123', url: DEPLOY_URL });
    };

    vi.mocked(vercel).mockImplementation(impl);
    vi.mocked(deno).mockImplementation(impl);
    vi.mocked(cloudflare).mockImplementation(impl);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;

    delete process.env.BETTER_AUTH_SECRET;

    vi.restoreAllMocks();
  });

  const setupProject = async ({ withAuth, withDb, withPublisher = false }: { withAuth: boolean; withDb: boolean; withPublisher?: boolean }) => {
    await generateTypebaseProject(tmp, { withAuth, withPublisher });

    if (!withDb) {
      fs.rmSync(path.join(tmp.path, 'typebase/db'), { recursive: true, force: true });
    }
  };

  const scaffoldTypeCleanProject = async () => {
    await generateTypebaseProject(tmp, { withAuth: true });
    await withCwd(tmp.path, () => auth.parseAsync(['generate'], { from: 'user' }));
    await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));
  };

  const useRealValidateTypes = async () => {
    const actual = await vi.importActual<typeof ValidateTypes>('#helpers/shared/validate-types.ts');

    vi.mocked(ValidateTypes.validateTypes).mockImplementation(actual.validateTypes);
  };

  describe('builds and deploys the expected server for each provider and project shape', () => {
    const deployFns = { vercel, deno, cloudflare } as const;

    const cases = [
      { name: 'vercel-auth-db', provider: 'vercel', withAuth: true, withDb: true, withPublisher: false, files: JS_AUTH_DB },
      { name: 'vercel-db-only', provider: 'vercel', withAuth: false, withDb: true, withPublisher: false, files: JS_DB_ONLY },
      { name: 'vercel-bare', provider: 'vercel', withAuth: false, withDb: false, withPublisher: false, files: JS_BARE },
      { name: 'deno-auth-db', provider: 'deno', withAuth: true, withDb: true, withPublisher: false, files: JS_AUTH_DB },
      { name: 'deno-db-only', provider: 'deno', withAuth: false, withDb: true, withPublisher: false, files: JS_DB_ONLY },
      { name: 'deno-bare', provider: 'deno', withAuth: false, withDb: false, withPublisher: false, files: JS_BARE },
      { name: 'cloudflare-auth-db', provider: 'cloudflare', withAuth: true, withDb: true, withPublisher: false, files: JS_AUTH_DB },
      { name: 'cloudflare-db-only', provider: 'cloudflare', withAuth: false, withDb: true, withPublisher: false, files: JS_DB_ONLY },
      { name: 'cloudflare-bare', provider: 'cloudflare', withAuth: false, withDb: false, withPublisher: false, files: JS_BARE },
      { name: 'vercel-publisher', provider: 'vercel', withAuth: false, withDb: true, withPublisher: true, files: JS_PUBLISHER },
    ] as const;

    it.each(cases)('builds and deploys $name', async ({ name, provider, withAuth, withDb, withPublisher, files }) => {
      await setupProject({ withAuth, withDb, withPublisher });

      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', provider], { from: 'user' }));

      expectProject(tmp, name, files, { namespace: 'deploy', root: 'captured' });
      expect(deployFns[provider]).toHaveBeenCalledOnce();

      for (const [other, fn] of Object.entries(deployFns)) {
        if (other !== provider) expect(fn).not.toHaveBeenCalled();
      }
    });
  });

  it('refuses to deploy a project that has auth but no database schema', async () => {
    await setupProject({ withAuth: true, withDb: false });

    await expect(withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow(
      'Found `auth.ts` but no database schema at `db/schema.ts`'
    );

    expect(vercel).not.toHaveBeenCalled();
  });

  describe('provider resolution', () => {
    it('prompts for a provider when none is configured and saves it to typebase.json', async () => {
      vi.mocked(select).mockResolvedValue('deno');

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev'], { from: 'user' }));

      expect(select).toHaveBeenCalledOnce();
      expect(deno).toHaveBeenCalledOnce();
      expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ serverProvider: 'deno' });
    });

    it('uses the provider configured in typebase.json without prompting', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev'], { from: 'user' }));

      expect(select).not.toHaveBeenCalled();
      expect(vercel).toHaveBeenCalledOnce();
    });

    it('saves the --provider flag when nothing is configured', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'cloudflare'], { from: 'user' }));

      expect(select).not.toHaveBeenCalled();
      expect(cloudflare).toHaveBeenCalledOnce();
      expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ serverProvider: 'cloudflare' });
    });

    it('deploys to the --provider flag but leaves an existing configured provider untouched', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'deno'], { from: 'user' }));

      expect(deno).toHaveBeenCalledOnce();
      expect(vercel).not.toHaveBeenCalled();
      expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ serverProvider: 'vercel' });
    });
  });

  describe('target', () => {
    it('pushes to the neon dev branch and records the dev app URL', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(neon).toHaveBeenCalledWith({ target: 'dev' });
      expect(tmp.read('.env')).toContain(`TYPEBASE_APP_URL_DEV=${DEPLOY_URL}`);
    });

    it('pushes to the neon prod branch and records the prod app URL', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['prod', '--provider', 'vercel'], { from: 'user' }));

      expect(neon).toHaveBeenCalledWith({ target: 'prod' });
      expect(tmp.read('.env')).toContain(`TYPEBASE_APP_URL=${DEPLOY_URL}`);
      expect(tmp.read('.env')).not.toContain('TYPEBASE_APP_URL_DEV');
    });

    it('rejects a target other than dev or prod', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);

      vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      await setupProject({ withAuth: true, withDb: true });
      await expect(withCwd(tmp.path, () => deploy.parseAsync(['staging', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow(
        'process.exit called'
      );

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(vercel).not.toHaveBeenCalled();
    });

    it('rejects an invalid --provider choice', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);

      vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      await setupProject({ withAuth: true, withDb: true });
      await expect(withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'fly'], { from: 'user' }))).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('database', () => {
    it('pushes the schema and includes the connection string in the deploy env', async () => {
      await setupProject({ withAuth: false, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(neon).toHaveBeenCalledWith({ target: 'dev' });
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: CONNECTION_URI }));
      expect(capturedEnv).toContainEqual({ key: 'DATABASE_URL', value: CONNECTION_URI, secret: true });
    });

    it('skips neon and the database env when there is no schema', async () => {
      await setupProject({ withAuth: false, withDb: false });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(neon).not.toHaveBeenCalled();
      expect(pushSchema).not.toHaveBeenCalled();
      expect(capturedEnv.map((e) => e.key)).not.toContain('DATABASE_URL');
    });

    it('still deploys when the provider already has the matching DATABASE_URL', async () => {
      vi.mocked(getVercelEnvVar).mockResolvedValue(CONNECTION_URI);

      await setupProject({ withAuth: false, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(getVercelEnvVar).toHaveBeenCalledWith({ key: 'DATABASE_URL', target: 'dev' });
      expect(vercel).toHaveBeenCalledOnce();
    });
  });

  describe('auth secret', () => {
    it('generates and ships a secret when the provider has none', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(getVercelEnvVar).toHaveBeenCalledWith({ key: 'BETTER_AUTH_SECRET', target: 'dev' });

      const secret = capturedEnv.find((e) => e.key === 'BETTER_AUTH_SECRET');

      expect(secret?.value).toBeTruthy();
      expect(tmp.read('.env')).toContain('BETTER_AUTH_SECRET=');
    });

    it('does not ship a secret when the provider already has one', async () => {
      vi.mocked(getVercelEnvVar).mockImplementation(({ key }) => Promise.resolve(key === 'BETTER_AUTH_SECRET' ? 'existing-secret' : undefined));

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(capturedEnv.map((e) => e.key)).not.toContain('BETTER_AUTH_SECRET');
    });

    it('does not read or ship a secret when there is no auth file', async () => {
      await setupProject({ withAuth: false, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(getVercelEnvVar).not.toHaveBeenCalledWith({ key: 'BETTER_AUTH_SECRET', target: 'dev' });
      expect(capturedEnv.map((e) => e.key)).not.toContain('BETTER_AUTH_SECRET');
    });
  });

  describe('reads env vars from the matching provider', () => {
    it('uses the deno env reader for deno deploys', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'deno'], { from: 'user' }));

      expect(getDenoEnvVar).toHaveBeenCalledWith({ key: 'DATABASE_URL', target: 'dev' });
      expect(getDenoEnvVar).toHaveBeenCalledWith({ key: 'BETTER_AUTH_SECRET', target: 'dev' });
      expect(getVercelEnvVar).not.toHaveBeenCalled();
      expect(getCloudflareEnvVar).not.toHaveBeenCalled();
    });

    it('uses the cloudflare env reader for cloudflare deploys', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'cloudflare'], { from: 'user' }));

      expect(getCloudflareEnvVar).toHaveBeenCalledWith({ key: 'DATABASE_URL', target: 'dev' });
      expect(getVercelEnvVar).not.toHaveBeenCalled();
      expect(getDenoEnvVar).not.toHaveBeenCalled();
    });
  });

  describe('side effects', () => {
    it('regenerates the project _generated types', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(tmp.exists('typebase/_generated/db.d.ts')).toBe(true);
      expect(tmp.exists('typebase/_generated/server.ts')).toBe(true);
    });

    it('prints the deployment id and url', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(vi.mocked(console.log).mock.calls.flat().map(String).join('\n')).toContain('Deployment Id: dep_123');
      expect(vi.mocked(console.log).mock.calls.flat().map(String).join('\n')).toContain(`Deployment URL: ${DEPLOY_URL}`);
    });

    it('does not stream logs unless --logs is passed', async () => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(streamLogs).not.toHaveBeenCalled();
    });

    it.each(['dev', 'prod'] as const)('streams the %s logs after deploying when --logs is passed', async (target) => {
      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync([target, '--provider', 'deno', '--logs'], { from: 'user' }));

      expect(streamLogs).toHaveBeenCalledWith({ target, provider: 'deno' });
      expect(vi.mocked(deno)).toHaveBeenCalledBefore(vi.mocked(streamLogs));
    });

    it('streams with the provider chosen at the prompt', async () => {
      vi.mocked(select).mockResolvedValue('cloudflare');

      await setupProject({ withAuth: true, withDb: true });
      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--logs'], { from: 'user' }));

      expect(streamLogs).toHaveBeenCalledWith({ target: 'dev', provider: 'cloudflare' });
    });

    it('skips the logs when the deployment fails', async () => {
      vi.mocked(vercel).mockRejectedValueOnce(new Error('deploy failed'));

      await setupProject({ withAuth: true, withDb: true });

      await expect(withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel', '--logs'], { from: 'user' }))).rejects.toThrow(
        'deploy failed'
      );

      expect(streamLogs).not.toHaveBeenCalled();
    });

    it('bundles the package-manager config file when one is generated', async () => {
      await setupProject({ withAuth: true, withDb: true });

      tmp.write('bun.lockb', '');

      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(tmp.exists('captured/bunfig.toml')).toBe(true);
    });
  });

  describe('type checking (real validateTypes)', () => {
    it('type-checks the real project and proceeds to deploy when it is valid', async () => {
      await scaffoldTypeCleanProject();
      await useRealValidateTypes();

      vi.mocked(ValidateTypes.validateTypes).mockClear();

      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(ValidateTypes.validateTypes).toHaveBeenCalledOnce();
      expect(vercel).toHaveBeenCalledOnce();
    });

    it('deploys past a stale `_generated` file that still points at a removed env schema', async () => {
      await scaffoldTypeCleanProject();
      await useRealValidateTypes();

      const generated = tmp.read('typebase/_generated/server.ts');

      tmp.write(
        'typebase/_generated/server.ts',
        generated.replace('import type {', 'import type { env as envSchema } from "../env.ts";\nimport type {')
      );

      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(vercel).toHaveBeenCalledOnce();
    });

    it('type-checks against freshly generated types when the project just gained a database', async () => {
      await generateTypebaseProject(tmp, { withAuth: false });

      fs.rmSync(path.join(tmp.path, 'typebase/db'), { recursive: true, force: true });
      fs.rmSync(path.join(tmp.path, 'typebase/actions'), { recursive: true, force: true });

      tmp.write(
        'typebase/actions/queries/ping.ts',
        'import { action } from "../../_generated/server.ts";\n\nexport const ping = action.handler(async () => "ok");\n'
      );

      await withCwd(tmp.path, () => codegen.parseAsync([], { from: 'user' }));

      await generateTypebaseProject(tmp, { withAuth: false });
      await useRealValidateTypes();

      await withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

      expect(vercel).toHaveBeenCalledOnce();
    });

    it('catches actions left behind by a removed auth config instead of deploying them', async () => {
      await scaffoldTypeCleanProject();
      await useRealValidateTypes();

      fs.rmSync(path.join(tmp.path, 'typebase/auth.ts'));

      await expect(withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow(
        /Type checking failed/
      );

      expect(vercel).not.toHaveBeenCalled();
    });

    it('aborts before pushing or deploying when the project has a real type error', async () => {
      await scaffoldTypeCleanProject();
      await useRealValidateTypes();

      tmp.write('typebase/actions/queries/bad.ts', 'export const value: number = "not a number";\n');

      await expect(withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow(
        /Type checking failed/
      );

      expect(neon).not.toHaveBeenCalled();
      expect(vercel).not.toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    it('propagates a generator failure without deploying', async () => {
      vi.mocked(generatePackageJson).mockRejectedValueOnce(new Error('boom'));

      await setupProject({ withAuth: true, withDb: true });
      await expect(withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow('boom');

      expect(vercel).not.toHaveBeenCalled();
    });

    it('propagates a neon failure without deploying', async () => {
      vi.mocked(neon).mockRejectedValueOnce(new Error('neon down'));

      await setupProject({ withAuth: true, withDb: true });
      await expect(withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow('neon down');

      expect(vercel).not.toHaveBeenCalled();
    });

    it('propagates a schema push failure without deploying', async () => {
      vi.mocked(pushSchema).mockRejectedValueOnce(new Error('push failed'));

      await setupProject({ withAuth: true, withDb: true });
      await expect(withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow('push failed');

      expect(vercel).not.toHaveBeenCalled();
    });

    it('propagates a deploy failure', async () => {
      vi.mocked(vercel).mockRejectedValueOnce(new Error('deploy failed'));

      await setupProject({ withAuth: true, withDb: true });
      await expect(withCwd(tmp.path, () => deploy.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow('deploy failed');
    });
  });
});
