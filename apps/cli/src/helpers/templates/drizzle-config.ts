import { type ServerAdapter } from '#helpers/constants.ts';

export const drizzleConfigTemplate = ({ ts, adapter }: { ts: boolean; adapter: ServerAdapter }) => {
  return `import { defineConfig } from "drizzle-kit";
${adapter === 'cloudflare' ? 'import { env } from "cloudflare:workers";\n' : ''}
export default defineConfig({
  out: "./drizzle",
  schema: "${ts ? './src/db/schema.ts' : './src/db/schema.js'}",
  dialect: "postgresql",
  dbCredentials: {
    url: ${adapter === 'cloudflare' ? 'env.DATABASE_URL' : 'process.env.DATABASE_URL'} || "",
    ssl: "verify-full",
  },
});`;
};
