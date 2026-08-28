import fs from 'node:fs/promises';
import path from 'node:path';

import type { generateDrizzleJson } from 'drizzle-kit/api-postgres';

export type PostgresSnapshot = Awaited<ReturnType<typeof generateDrizzleJson>>;

export interface Migration {
  name: string;
  dirPath: string;
  snapshot: PostgresSnapshot;
}

export const readMigrations = async (migrationsDirPath: string): Promise<Migration[]> => {
  const entries = await fs.readdir(migrationsDirPath, { withFileTypes: true }).catch(() => []);

  const migrations = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const dirPath = path.join(migrationsDirPath, entry.name);
        const contents = await fs.readFile(path.join(dirPath, 'snapshot.json'), 'utf8').catch(() => undefined);

        if (contents === undefined) {
          return undefined;
        }

        return { name: entry.name, dirPath, snapshot: JSON.parse(contents) as PostgresSnapshot };
      })
  );

  return migrations.filter((migration) => migration !== undefined).sort((a, b) => a.name.localeCompare(b.name));
};
