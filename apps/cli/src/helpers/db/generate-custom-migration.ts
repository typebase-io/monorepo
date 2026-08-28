import { generateDrizzleJson } from 'drizzle-kit/api-postgres';

import { assertSingleLeaf } from '#helpers/db/assert-single-leaf.ts';
import { readMigrations } from '#helpers/db/read-migrations.ts';
import { writeMigration } from '#helpers/db/write-migration.ts';

export const generateCustomMigration = async ({
  migrationsDirPath,
  name,
  ignoreConflicts,
}: {
  migrationsDirPath: string;
  name: string | undefined;
  ignoreConflicts?: boolean;
}) => {
  const migrations = await readMigrations(migrationsDirPath);

  if (!ignoreConflicts) {
    assertSingleLeaf(migrations);
  }

  const snapshot = migrations.at(-1)?.snapshot ?? (await generateDrizzleJson({}));

  return writeMigration({ migrationsDirPath, name, sqlStatements: [], snapshot });
};
