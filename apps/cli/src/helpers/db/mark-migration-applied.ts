import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import ora from 'ora';

import { readMigrationFiles } from '#helpers/db/read-migration-files.ts';

const MIGRATIONS_SCHEMA = 'drizzle';
const MIGRATIONS_TABLE = '__drizzle_migrations';

export const markMigrationApplied = async ({
  migrationsDirPath,
  connectionUri,
  name,
}: {
  migrationsDirPath: string;
  connectionUri: string;
  name: string;
}) => {
  const migration = readMigrationFiles(migrationsDirPath).find((candidate) => candidate.name === name);

  if (!migration) {
    return { marked: false };
  }

  const db = drizzle(connectionUri);

  db.$client.on('error', () => {
    // Do nothing
  });

  const spinner = ora('Marking the baseline as applied...').start();

  try {
    await db.execute(sql`
      CREATE SCHEMA IF NOT EXISTS ${sql.identifier(MIGRATIONS_SCHEMA)}
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(MIGRATIONS_SCHEMA)}.${sql.identifier(MIGRATIONS_TABLE)} (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint,
        name text,
        applied_at timestamp with time zone DEFAULT now()
      )
    `);

    const recorded = await db.execute<{ name: string }>(
      sql`SELECT name FROM ${sql.identifier(MIGRATIONS_SCHEMA)}.${sql.identifier(MIGRATIONS_TABLE)} WHERE name = ${migration.name}`
    );

    if (recorded.rows.length > 0) {
      return { marked: false };
    }

    await db.execute(
      sql`INSERT INTO ${sql.identifier(MIGRATIONS_SCHEMA)}.${sql.identifier(MIGRATIONS_TABLE)} ("hash", "created_at", "name") values(${migration.hash}, ${migration.folderMillis}, ${migration.name})`
    );

    return { marked: true };
  } finally {
    spinner.stop();

    await db.$client.end();
  }
};
