export const drizzleConfigTemplate = ({ ts }: { ts: boolean }) => {
  return `import { defineConfig } from "drizzle-kit";
import { env } from "${ts ? '../env.ts' : '../env.js'}";

export default defineConfig({
  out: "./drizzle",
  schema: "${ts ? './src/db/schema.ts' : './src/db/schema.js'}",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
    ssl: "verify-full",
  },
});`;
};
