import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DEPS, serverAdapters, serverProviders, typebaseConfigSchema } from '#helpers/constants.ts';

describe('constants', () => {
  it('exposes the supported server adapters and providers', () => {
    expect(serverAdapters).toEqual(['node', 'bun', 'cloudflare', 'deno', 'fastify', 'hono']);
    expect(serverProviders).toEqual(['vercel', 'cloudflare', 'deno']);
  });
});

describe('DEPS', () => {
  it('stays in sync with the versions the monorepo is built against', async () => {
    const monorepoRoot = fileURLToPath(new URL('../../../../..', import.meta.url));

    const readPackageJson = async (...segments: string[]) =>
      JSON.parse(await readFile(path.join(monorepoRoot, ...segments, 'package.json'), 'utf-8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

    const corePackageJson = await readPackageJson('apps', 'core');
    const cliPackageJson = await readPackageJson('apps', 'cli');

    const workspaceVersions: Record<string, string> = {};

    for (const dependencies of [
      corePackageJson.dependencies,
      corePackageJson.devDependencies,
      cliPackageJson.dependencies,
      cliPackageJson.devDependencies,
    ]) {
      for (const [name, version] of Object.entries(dependencies ?? {})) {
        workspaceVersions[name] = version;
      }
    }

    const mismatches = Object.values(DEPS)
      .filter(({ name, version }) => name in workspaceVersions && workspaceVersions[name] !== version)
      .map(({ name, version }) => ({ name, deps: version, workspace: workspaceVersions[name] }));

    expect(mismatches).toEqual([]);
  });
});

describe('typebaseConfigSchema', () => {
  it('accepts an empty config', () => {
    expect(typebaseConfigSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a fully populated config', () => {
    const result = typebaseConfigSchema.safeParse({
      projectPath: 'src/typebase',
      serverProvider: 'vercel',
      server: { output: 'esm', adapter: 'hono', skipLoadEnv: true, outDir: 'out', port: 3000 },
      vercel: { projectId: 'p', projectName: 'n' },
      neon: { orgId: 'o', projectId: 'p' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown server adapter', () => {
    expect(typebaseConfigSchema.safeParse({ server: { adapter: 'rails' } }).success).toBe(false);
  });

  it('rejects an unknown server provider', () => {
    expect(typebaseConfigSchema.safeParse({ serverProvider: 'aws' }).success).toBe(false);
  });

  it('rejects a non-positive port', () => {
    expect(typebaseConfigSchema.safeParse({ server: { port: 0 } }).success).toBe(false);
    expect(typebaseConfigSchema.safeParse({ server: { port: -1 } }).success).toBe(false);
  });

  it('rejects an empty project path', () => {
    expect(typebaseConfigSchema.safeParse({ projectPath: '' }).success).toBe(false);
  });

  it('rejects a vercel config missing required fields', () => {
    expect(typebaseConfigSchema.safeParse({ vercel: { projectId: 'p' } }).success).toBe(false);
  });
});
