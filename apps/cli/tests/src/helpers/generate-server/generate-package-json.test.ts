import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generatePackageJson } from '#helpers/generate-server/generate-package-json.ts';
import { getPackageManager } from '#helpers/shared/get-package-manager.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/shared/get-package-manager.ts', () => ({ getPackageManager: vi.fn() }));

describe('generatePackageJson', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  const setup = (packageJson: Record<string, unknown>) => {
    tmp.write('typebase/package.json', JSON.stringify(packageJson));
    tmp.write('typebase/actions/todos.ts', `import { z } from 'zod';\nexport const x = z;`);

    const outputDirPath = tmp.mkdir('out');

    return { typebaseDirPath: path.join(tmp.path, 'typebase'), outputDirPath };
  };

  it('builds a node + ts + auth package.json with pnpm metadata', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('pnpm');

    const { typebaseDirPath, outputDirPath } = setup({ dependencies: { 'typebase-io': '0.1.0', zod: '3.2.1' } });

    await generatePackageJson({
      adapter: 'node',
      typebaseDirPath,
      outputDirPath,
      generation: 'ts',
      outDir: '_server',
      configuredOutDir: '_server',
      hasAuth: true,
      hasEnv: true,
    });

    expect(tmp.read('out/package.json')).toEqualTemplate('generate-package-json', 'node-ts-auth-pnpm.txt');
  });

  it('builds a cloudflare + esm package.json without auth or dotenv', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('npm');

    const { typebaseDirPath, outputDirPath } = setup({ devDependencies: { 'typebase-io': '0.2.0' } });

    await generatePackageJson({
      adapter: 'cloudflare',
      typebaseDirPath,
      outputDirPath,
      generation: 'esm',
      outDir: '_server',
      configuredOutDir: '_server',
      hasAuth: false,
      hasEnv: true,
    });

    expect(tmp.read('out/package.json')).toEqualTemplate('generate-package-json', 'cloudflare-esm.txt');
  });

  it('builds a fastify + cjs package.json with cors when auth is enabled', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('bun');

    const { typebaseDirPath, outputDirPath } = setup({ dependencies: { '@typebase-io/typebase': '0.3.0' } });

    await generatePackageJson({
      adapter: 'fastify',
      typebaseDirPath,
      outputDirPath,
      generation: 'cjs',
      outDir: '_server',
      configuredOutDir: '_server',
      hasAuth: true,
      hasEnv: true,
    });

    expect(tmp.read('out/package.json')).toEqualTemplate('generate-package-json', 'fastify-cjs-auth-bun.txt');
  });

  it('omits @fastify/cors for a fastify server without auth', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('npm');

    const { typebaseDirPath, outputDirPath } = setup({ dependencies: { 'typebase-io': '0.1.0' } });

    await generatePackageJson({
      adapter: 'fastify',
      typebaseDirPath,
      outputDirPath,
      generation: 'esm',
      outDir: '_server',
      configuredOutDir: '_server',
      hasAuth: false,
      hasEnv: true,
    });

    expect(tmp.read('out/package.json')).toEqualTemplate('generate-package-json', 'fastify-esm-noauth.txt');
  });

  it('resolves the typebase version from a scoped @typebase-io/typebase devDependency', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('npm');

    const { typebaseDirPath, outputDirPath } = setup({ devDependencies: { '@typebase-io/typebase': '0.4.0' } });

    await generatePackageJson({
      adapter: 'node',
      typebaseDirPath,
      outputDirPath,
      generation: 'esm',
      outDir: '_server',
      configuredOutDir: '_server',
      hasAuth: false,
      hasEnv: true,
    });

    expect(tmp.read('out/package.json')).toEqualTemplate('generate-package-json', 'typebase-version-from-scoped-devdep.txt');
  });

  it('pins the server dependency version over a conflicting user dependency', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('npm');

    const { typebaseDirPath, outputDirPath } = setup({ dependencies: { 'typebase-io': '0.1.0', 'drizzle-orm': '99.0.0' } });

    tmp.write('typebase/actions/todos.ts', `import { one } from 'drizzle-orm';\nexport const x = one;`);

    await generatePackageJson({
      adapter: 'node',
      typebaseDirPath,
      outputDirPath,
      generation: 'esm',
      outDir: '_server',
      configuredOutDir: '_server',
      hasAuth: false,
      hasEnv: true,
    });

    expect(tmp.read('out/package.json')).toEqualTemplate('generate-package-json', 'pins-server-dep-over-user-dep.txt');
  });

  it('builds a hono package.json and omits the packageManager field when it is unknown', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('unknown');

    const { typebaseDirPath, outputDirPath } = setup({ dependencies: {} });

    await generatePackageJson({
      adapter: 'hono',
      typebaseDirPath,
      outputDirPath,
      generation: 'ts',
      outDir: '_server',
      configuredOutDir: '_server',
      hasAuth: false,
      hasEnv: true,
    });

    expect(tmp.read('out/package.json')).toEqualTemplate('generate-package-json', 'hono-ts-unknown.txt');
  });

  it('omits @t3-oss/env-core and dotenv for a project without an env module', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('npm');

    const { typebaseDirPath, outputDirPath } = setup({ dependencies: { 'typebase-io': '0.1.0' } });

    await generatePackageJson({
      adapter: 'node',
      typebaseDirPath,
      outputDirPath,
      generation: 'esm',
      outDir: '_server',
      configuredOutDir: '_server',
      hasAuth: false,
      hasEnv: false,
    });

    expect(tmp.read('out/package.json')).toEqualTemplate('generate-package-json', 'node-esm-no-env.txt');
  });

  describe('generated output already in the project', () => {
    const setupWithGeneratedServer = () => {
      const dirs = setup({ dependencies: { 'typebase-io': '0.1.0', zod: '3.2.1' } });

      tmp.write('typebase/_server/src/actions/todos.ts', `import { leftOver } from 'left-over-package';\nexport const x = leftOver;`);
      tmp.write('typebase/dist/actions/todos.ts', `import { built } from 'built-package';\nexport const x = built;`);

      return dirs;
    };

    it('never reads it as a source of dependencies', async () => {
      vi.mocked(getPackageManager).mockResolvedValue('npm');

      const { typebaseDirPath, outputDirPath } = setupWithGeneratedServer();

      await generatePackageJson({
        adapter: 'node',
        typebaseDirPath,
        outputDirPath,
        generation: 'esm',
        outDir: '_server',
        configuredOutDir: '_server',
        hasAuth: false,
        hasEnv: true,
      });

      expect(tmp.read('out/package.json')).not.toContain('left-over-package');
      expect(tmp.read('out/package.json')).not.toContain('built-package');
    });

    it('still skips it when the server is generated somewhere else entirely', async () => {
      vi.mocked(getPackageManager).mockResolvedValue('npm');

      const { typebaseDirPath, outputDirPath } = setupWithGeneratedServer();

      await generatePackageJson({
        adapter: 'node',
        typebaseDirPath,
        outputDirPath,
        generation: 'esm',
        outDir: path.join(tmp.path, 'cache', 'server'),
        configuredOutDir: '_server',
        hasAuth: false,
        hasEnv: true,
      });

      expect(tmp.read('out/package.json')).not.toContain('left-over-package');
    });
  });
});
