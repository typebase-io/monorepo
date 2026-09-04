import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DEPS,
  LOCAL_SERVER_CACHE_MARKER_FILE_NAME,
  SERVER_MARKER_FILE_NAME,
  TYPEBASE_CONFIG_FILE_NAME,
  envTargets,
  publisherProviders,
  serverAdapters,
  serverMarkerSchema,
  serverModes,
  serverOutputs,
  serverProviders,
  typebaseConfigSchema,
} from '#helpers/constants.ts';

describe('constants', () => {
  it('exposes the supported server adapters, server outputs, server modes, server providers, publisher providers and env targets', () => {
    expect(serverAdapters).toEqual(['node', 'bun', 'cloudflare', 'deno', 'fastify', 'hono']);
    expect(serverOutputs).toEqual(['ts', 'esm', 'cjs']);
    expect(serverModes).toEqual(['standalone', 'embedded']);
    expect(serverProviders).toEqual(['vercel', 'cloudflare', 'deno']);
    expect(publisherProviders).toEqual(['db']);
    expect(envTargets).toEqual(['dev', 'prod']);
  });

  it('names the files the CLI reads and writes by convention', () => {
    expect(TYPEBASE_CONFIG_FILE_NAME).toBe('typebase.json');
    expect(LOCAL_SERVER_CACHE_MARKER_FILE_NAME).toBe('typebase-server-cache.json');
    expect(SERVER_MARKER_FILE_NAME).toBe('typebase-server.json');
  });

  it('keeps the marker file name distinct from the project config, which can share its directory', () => {
    expect(SERVER_MARKER_FILE_NAME).not.toBe(TYPEBASE_CONFIG_FILE_NAME);
  });

  it('accepts every server output in the config schema', () => {
    for (const output of serverOutputs) {
      expect(typebaseConfigSchema.safeParse({ server: { output } }).success).toBe(true);
    }

    expect(typebaseConfigSchema.safeParse({ server: { output: 'swc' } }).success).toBe(false);
  });

  it('accepts a boolean embedded setting in the config schema', () => {
    for (const embedded of [true, false]) {
      expect(typebaseConfigSchema.safeParse({ server: { embedded } }).success).toBe(true);
    }

    expect(typebaseConfigSchema.safeParse({ server: { embedded: 'true' } }).success).toBe(false);
  });

  it('publishes the embedded boolean in the JSON schema instead of a mode setting', async () => {
    const schema = JSON.parse(await readFile(new URL('../../../src/helpers/typebase.schema.json', import.meta.url), 'utf8')) as {
      properties: { server: { properties: Record<string, unknown> } };
    };

    expect(schema.properties.server.properties.embedded).toEqual({
      type: 'boolean',
      default: false,
      description: 'Generate an embedded server for your application to mount. Defaults to false.',
    });
    expect(schema.properties.server.properties.mode).toBeUndefined();
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

describe('serverMarkerSchema', () => {
  const MARKER = {
    adapter: 'node',
    mode: 'standalone',
    cliVersion: '1.2.3',
    dependencies: { 'drizzle-orm': '1.0.0' },
    devDependencies: { typescript: '5.9.3' },
    envKeys: ['DATABASE_URL'],
  };

  it('accepts a marker the generator writes', () => {
    expect(serverMarkerSchema.safeParse(MARKER).success).toBe(true);
  });

  it('accepts every mode and adapter', () => {
    for (const mode of serverModes) {
      for (const adapter of serverAdapters) {
        expect(serverMarkerSchema.safeParse({ ...MARKER, mode, adapter }).success).toBe(true);
      }
    }
  });

  it('accepts a marker written by a newer CLI with an adapter or mode this version does not know', () => {
    expect(serverMarkerSchema.safeParse({ ...MARKER, adapter: 'rails' }).success).toBe(true);
    expect(serverMarkerSchema.safeParse({ ...MARKER, mode: 'mounted' }).success).toBe(true);
  });

  it('rejects a marker missing any of the fields it is meant to record', () => {
    for (const field of Object.keys(MARKER)) {
      expect(serverMarkerSchema.safeParse({ ...MARKER, [field]: undefined }).success).toBe(false);
    }
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
      server: { output: 'esm', adapter: 'hono', embedded: true, outDir: 'out', port: 3000 },
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
