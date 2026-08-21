import { z } from 'zod';

import type { PackageManager } from '#helpers/shared/get-package-manager.ts';

export const TYPEBASE_CONFIG_FILE_NAME = 'typebase.json';
export const TYPEBASE_CONFIG_SCHEMA_URL =
  'https://raw.githubusercontent.com/typebase-io/monorepo/refs/heads/main/apps/cli/src/helpers/typebase.schema.json';

export const serverAdapters = ['node', 'bun', 'cloudflare', 'deno', 'fastify', 'hono'] as const;
export type ServerAdapter = (typeof serverAdapters)[number];

export const serverProviders = ['vercel', 'cloudflare', 'deno'] as const;
export type ServerProvider = (typeof serverProviders)[number];

export const publisherProviders = ['db'] as const;
export type PublisherProvider = (typeof publisherProviders)[number];

export const envTargets = ['dev', 'prod'] as const;
export type EnvTarget = (typeof envTargets)[number];

export const DEPS = {
  '@better-auth/drizzle-adapter': {
    name: '@better-auth/drizzle-adapter',
    version: '1.6.11',
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
    version: '1.14.3',
  },
  '@t3-oss/env-core': {
    name: '@t3-oss/env-core',
    version: '0.13.11',
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
    version: '1.6.11',
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
    version: '4.12.18',
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
  projectPath: z.optional(
    z.string().trim().min(1).meta({
      title: 'Project path',
      description: 'Path to the Typebase project directory.',
    })
  ),
  serverProvider: z.optional(
    z.enum(serverProviders).meta({
      title: 'Server provider',
      description: 'The server provider to deploy to.',
    })
  ),
  server: z.optional(
    z
      .object({
        output: z.optional(
          z.enum(['ts', 'esm', 'cjs']).meta({
            title: 'Output',
            description: 'The output format for the server build.',
          })
        ),
        adapter: z.optional(
          z.enum(serverAdapters).meta({
            title: 'Adapter',
            description: 'The server adapter to use.',
          })
        ),
        outDir: z.optional(
          z.string().trim().min(1).meta({
            title: 'Output directory',
            description: 'The output directory for the server build.',
          })
        ),
        port: z.optional(
          z.number().int().positive().meta({
            title: 'Port',
            description: 'The port the generated server listens on.',
          })
        ),
      })
      .meta({ title: 'Server', description: 'Server build configuration.' })
  ),
  vercel: z.optional(
    z
      .object({
        projectId: z.string().meta({
          title: 'Project ID',
          description: 'The Vercel project ID.',
        }),
        projectName: z.string().meta({
          title: 'Project name',
          description: 'The Vercel project name.',
        }),
        orgId: z.optional(
          z.string().meta({
            title: 'Organization ID',
            description: 'The Vercel organization ID.',
          })
        ),
      })
      .meta({ title: 'Vercel', description: 'Vercel deployment configuration.' })
  ),
  cloudflare: z.optional(
    z
      .object({
        accountId: z.string().meta({
          title: 'Account ID',
          description: 'The Cloudflare account ID.',
        }),
        workerName: z.string().meta({
          title: 'Worker name',
          description: 'The Cloudflare Worker name.',
        }),
        subdomain: z.string().meta({
          title: 'Subdomain',
          description: 'The Cloudflare Workers subdomain.',
        }),
      })
      .meta({ title: 'Cloudflare', description: 'Cloudflare deployment configuration.' })
  ),
  deno: z.optional(
    z
      .object({
        org: z.string().meta({
          title: 'Organization',
          description: 'The Deno Deploy organization.',
        }),
        projectId: z.string().meta({
          title: 'Project ID',
          description: 'The Deno Deploy project ID.',
        }),
        slug: z.string().meta({
          title: 'Slug',
          description: 'The Deno Deploy project slug.',
        }),
      })
      .meta({ title: 'Deno', description: 'Deno Deploy configuration.' })
  ),
  neon: z.optional(
    z
      .object({
        orgId: z.string().meta({
          title: 'Organization ID',
          description: 'The Neon organization ID.',
        }),
        projectId: z.string().meta({
          title: 'Project ID',
          description: 'The Neon project ID.',
        }),
      })
      .meta({ title: 'Neon', description: 'Neon database configuration.' })
  ),
});

export type TypebaseConfigSchema = z.infer<typeof typebaseConfigSchema>;
