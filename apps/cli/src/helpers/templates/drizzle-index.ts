import { type ServerAdapter } from '#helpers/constants.ts';

export const drizzleIndexTemplate = (adapter: ServerAdapter) => {
  const isCloudflare = adapter === 'cloudflare';

  return `${isCloudflare ? 'import { drizzle } from "drizzle-orm/neon-http";' : 'import { drizzle } from "drizzle-orm/node-postgres";'}
import { relations } from "./relations.ts";
${isCloudflare ? 'import { env } from "cloudflare:workers";' : ''}

export const db = drizzle(${isCloudflare ? 'env.DATABASE_URL' : 'process.env.DATABASE_URL'} || '', { relations, casing: 'snake_case' });`;
};
