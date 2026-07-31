import { type ServerAdapter } from '#helpers/constants.ts';

export const drizzleIndexTemplate = ({ ts, adapter }: { ts: boolean; adapter: ServerAdapter }) => {
  const isCloudflare = adapter === 'cloudflare';

  return `${isCloudflare ? 'import { drizzle } from "drizzle-orm/neon-http";' : 'import { drizzle } from "drizzle-orm/node-postgres";'}
import { relations } from "${ts ? './relations.ts' : './relations.js'}";
import { env } from "${ts ? '../env.ts' : '../env.js'}";

export const db = drizzle(env.DATABASE_URL, { relations, casing: "snake_case" });`;
};
