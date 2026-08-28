import { generateMigration as diffSnapshots, generateDrizzleJson } from 'drizzle-kit/api-postgres';

import { type ServerProvider } from '#helpers/constants.ts';
import { assertSingleLeaf } from '#helpers/db/assert-single-leaf.ts';
import { buildSnapshot } from '#helpers/db/build-snapshot.ts';
import { readMigrations } from '#helpers/db/read-migrations.ts';
import { writeMigration } from '#helpers/db/write-migration.ts';

export const generateMigration = async <T extends boolean = false>({
  dbDirPath,
  migrationsDirPath,
  serverProvider,
  name,
  ignoreConflicts,
  allowEmpty,
  quiet,
}: {
  dbDirPath: string;
  migrationsDirPath: string;
  serverProvider: ServerProvider | undefined;
  name: string | undefined;
  ignoreConflicts?: boolean;
  allowEmpty?: T;
  quiet?: boolean;
}): Promise<T extends true ? { name: string; dirPath: string } : { name: string; dirPath: string } | undefined> => {
  const migrations = await readMigrations(migrationsDirPath);

  if (!ignoreConflicts) {
    assertSingleLeaf(migrations);
  }

  const previous = migrations.at(-1)?.snapshot;
  const snapshot = await buildSnapshot({ dbDirPath, serverProvider, prevId: previous?.id, quiet });
  const sqlStatements = await diffSnapshots(previous ?? (await generateDrizzleJson({})), snapshot);

  if (sqlStatements.length === 0 && !allowEmpty) {
    return undefined as T extends true ? { name: string; dirPath: string } : { name: string; dirPath: string } | undefined;
  }

  return writeMigration({ migrationsDirPath, name, sqlStatements: sqlStatements.length === 0 ? undefined : sqlStatements, snapshot });
};
