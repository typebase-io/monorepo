import { describe, expect, it } from 'vitest';

import { serverAdapters, serverProviders, typebaseConfigSchema } from '#helpers/constants.ts';

describe('constants', () => {
  it('exposes the supported server adapters and providers', () => {
    expect(serverAdapters).toEqual(['node', 'bun', 'cloudflare', 'deno', 'fastify', 'hono']);
    expect(serverProviders).toEqual(['vercel', 'cloudflare', 'deno']);
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
