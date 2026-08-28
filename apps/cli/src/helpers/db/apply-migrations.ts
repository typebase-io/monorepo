import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/pg-core/async/session';
import ora from 'ora';

import { readMigrationFiles } from '#helpers/db/read-migration-files.ts';

const MIGRATIONS_SCHEMA = 'drizzle';
const MIGRATIONS_TABLE = '__drizzle_migrations';

export const applyMigrations = async ({ migrationsDirPath, connectionUri }: { migrationsDirPath: string; connectionUri: string }) => {
  const migrations = readMigrationFiles(migrationsDirPath);

  if (migrations.length === 0) {
    return { applied: [] };
  }

  const db = drizzle(connectionUri);

  db.$client.on('error', () => {
    // Do nothing
  });

  const spinner = ora('Applying migrations...').start();

  try {
    const result = await db
      .execute<{ name: string | null }>(sql`select name from ${sql.identifier(MIGRATIONS_SCHEMA)}.${sql.identifier(MIGRATIONS_TABLE)}`)
      .catch(() => undefined);

    const alreadyApplied = new Set((result?.rows ?? []).map((row) => row.name).filter((name) => name !== null));

    await migrate(migrations, db, { migrationsFolder: migrationsDirPath, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE });

    return {
      applied: migrations.map(({ name }) => name).filter((name) => !alreadyApplied.has(name)),
    };
  } finally {
    spinner.stop();

    await db.$client.end();
  }
};
