import { z } from 'zod';

import type { PackageManager } from '#helpers/shared/get-package-manager.ts';

export const TYPEBASE_CONFIG_FILE_NAME = 'typebase.json';
export const TYPEBASE_CONFIG_SCHEMA_URL =
  'https://raw.githubusercontent.com/typebase-io/monorepo/refs/heads/main/apps/cli/src/helpers/typebase.schema.json';

export const serverAdapters = ['node', 'bun', 'cloudflare', 'deno', 'fastify', 'hono'] as const;
export type ServerAdapter = (typeof serverAdapters)[number];

export const serverProviders = ['vercel', 'cloudflare', 'deno'] as const;
export type ServerProvider = (typeof serverProviders)[number];

export const DEPS = {
  '@better-auth/drizzle-adapter': {
    name: '@better-auth/drizzle-adapter',
    version: '1.6.8',
  },
  '@fastify/cors': {
    name: '@fastify/cors',
    version: '11.2.0',
  },
  '@neondatabase/serverless': {
    name: '@neondatabase/serverless',
    version: '1.1.0',
  },
  '@orpc/server': {
    name: '@orpc/server',
    version: '1.14.0',
  },
  '@types/node': {
    name: '@types/node',
    version: '24.1.0',
  },
  '@types/pg': {
    name: '@types/pg',
    version: '8.20.0',
  },
  'better-auth': {
    name: 'better-auth',
    version: '1.6.8',
  },
  dotenv: {
    name: 'dotenv',
    version: '17.4.2',
  },
  'drizzle-kit': {
    name: 'drizzle-kit',
    version: '1.0.0-beta.22',
  },
  'drizzle-orm': {
    name: 'drizzle-orm',
    version: '1.0.0-beta.22',
  },
  fastify: {
    name: 'fastify',
    version: '5.8.5',
  },
  hono: {
    name: 'hono',
    version: '4.12.14',
  },
  pg: {
    name: 'pg',
    version: '8.20.0',
  },
  typescript: {
    name: 'typescript',
    version: '5.9.3',
  },
};

export const PACKAGE_MANAGER_VERSIONS = {
  npm: '10.9.2',
  pnpm: '10.0.0',
  'yarn-classic': '1.22.22',
  'yarn-berry': '4.5.0',
  bun: '1.1.38',
} as const satisfies Record<Exclude<PackageManager, 'unknown'>, string>;

export const PACKAGE_MANAGER_FIELD_NAMES = {
  npm: 'npm',
  pnpm: 'pnpm',
  'yarn-classic': 'yarn',
  'yarn-berry': 'yarn',
  bun: 'bun',
} as const satisfies Record<Exclude<PackageManager, 'unknown'>, string>;

export const typebaseConfigSchema = z.object({
  projectPath: z.optional(z.string().trim().min(1)),
  serverProvider: z.optional(z.enum(serverProviders)),
  server: z.optional(
    z.object({
      output: z.optional(z.enum(['ts', 'esm', 'cjs'])),
      adapter: z.optional(z.enum(serverAdapters)),
      skipLoadEnv: z.optional(z.boolean()),
      outDir: z.optional(z.string().trim().min(1)),
      port: z.optional(z.number().int().positive()),
    })
  ),
  vercel: z.optional(
    z.object({
      projectId: z.string(),
      projectName: z.string(),
      orgId: z.optional(z.string()),
    })
  ),
  cloudflare: z.optional(
    z.object({
      accountId: z.string(),
      workerName: z.string(),
      subdomain: z.string(),
    })
  ),
  deno: z.optional(
    z.object({
      org: z.string(),
      projectId: z.string(),
      slug: z.string(),
    })
  ),
  neon: z.optional(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
    })
  ),
});

export type TypebaseConfigSchema = z.infer<typeof typebaseConfigSchema>;
