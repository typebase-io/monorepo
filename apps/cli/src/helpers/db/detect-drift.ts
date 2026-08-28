import { type ServerProvider } from '#helpers/constants.ts';
import { buildSnapshot } from '#helpers/db/build-snapshot.ts';
import { readMigrations } from '#helpers/db/read-migrations.ts';

export const detectDrift = async ({
  dbDirPath,
  migrationsDirPath,
  serverProvider,
}: {
  dbDirPath: string;
  migrationsDirPath: string;
  serverProvider: ServerProvider | undefined;
}) => {
  const migrations = await readMigrations(migrationsDirPath);
  const previous = migrations.at(-1)?.snapshot;
  const snapshot = await buildSnapshot({ dbDirPath, serverProvider, prevId: previous?.id });

  const before = new Map(
    previous?.ddl.map((entity) => {
      const identity = [entity.entityType, 'schema' in entity ? entity.schema : '', 'table' in entity ? entity.table : '', entity.name].join('.');

      return [identity, entity];
    })
  );

  const after = new Map(
    snapshot.ddl.map((entity) => {
      const identity = [entity.entityType, 'schema' in entity ? entity.schema : '', 'table' in entity ? entity.table : '', entity.name].join('.');

      return [identity, entity];
    })
  );

  const tables = new Set<string>();

  for (const [identity, entity] of after) {
    const match = before.get(identity);

    if (!match || JSON.stringify(match) !== JSON.stringify(entity)) {
      const table = 'table' in entity ? entity.table : entity.name;

      tables.add(table);
    }
  }

  for (const [identity, entity] of before) {
    if (!after.has(identity)) {
      const table = 'table' in entity ? entity.table : entity.name;

      tables.add(table);
    }
  }

  return {
    tables: [...tables].sort((a, b) => a.localeCompare(b)),
  };
};
