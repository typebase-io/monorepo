import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { type MigrationMeta } from 'drizzle-orm/migrator';

export const readMigrationFiles = (migrationsDirPath: string): MigrationMeta[] => {
  if (!existsSync(migrationsDirPath)) {
    return [];
  }

  return readdirSync(migrationsDirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, sqlFilePath: path.join(migrationsDirPath, entry.name, 'migration.sql') }))
    .filter(({ sqlFilePath }) => existsSync(sqlFilePath))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, sqlFilePath }) => {
      const contents = readFileSync(sqlFilePath, 'utf8');
      const timestamp = name.slice(0, 14);

      const folderMillis = Date.UTC(
        Number(timestamp.slice(0, 4)),
        Number(timestamp.slice(4, 6)) - 1,
        Number(timestamp.slice(6, 8)),
        Number(timestamp.slice(8, 10)),
        Number(timestamp.slice(10, 12)),
        Number(timestamp.slice(12, 14))
      );

      return {
        name,
        sql: contents.split('\n\n----------------------------\n\n').filter((statement) => statement.trim() !== ''),
        folderMillis,
        hash: createHash('sha256').update(contents).digest('hex'),
        bps: true,
      };
    });
};
