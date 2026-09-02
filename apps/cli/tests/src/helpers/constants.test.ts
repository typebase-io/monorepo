import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DEPS,
  LOCAL_SERVER_CACHE_MARKER_FILE_NAME,
  TYPEBASE_CONFIG_FILE_NAME,
  envTargets,
  publisherProviders,
  serverAdapters,
  serverOutputs,
  serverProviders,
  typebaseConfigSchema,
} from '#helpers/constants.ts';

describe('constants', () => {
  it('exposes the supported server adapters, server outputs, server providers, publisher providers and env targets', () => {
    expect(serverAdapters).toEqual(['node', 'bun', 'cloudflare', 'deno', 'fastify', 'hono']);
    expect(serverOutputs).toEqual(['ts', 'esm', 'cjs']);
    expect(serverProviders).toEqual(['vercel', 'cloudflare', 'deno']);
    expect(publisherProviders).toEqual(['db']);
    expect(envTargets).toEqual(['dev', 'prod']);
  });

  it('names the files the CLI reads and writes by convention', () => {
    expect(TYPEBASE_CONFIG_FILE_NAME).toBe('typebase.json');
    expect(LOCAL_SERVER_CACHE_MARKER_FILE_NAME).toBe('typebase-server-cache.json');
  });

  it('accepts every server output in the config schema', () => {
    for (const output of serverOutputs) {
      expect(typebaseConfigSchema.safeParse({ server: { output } }).success).toBe(true);
    }

    expect(typebaseConfigSchema.safeParse({ server: { output: 'swc' } }).success).toBe(false);
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
      server: { output: 'esm', adapter: 'hono', outDir: 'out', port: 3000 },
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
