import { existsSync, readdirSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { type PostgresSnapshot } from '#helpers/db/read-migrations.ts';

export const writeMigration = async ({
  migrationsDirPath,
  name,
  sqlStatements,
  snapshot,
}: {
  migrationsDirPath: string;
  name: string | undefined;
  sqlStatements: string[] | undefined;
  snapshot: PostgresSnapshot;
}) => {
  const slug = name
    ? name
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '_')
        .replaceAll(/^_+|_+$/g, '')
    : '';

  const startedAt = Date.now();
  const takenTimestamps = new Set((existsSync(migrationsDirPath) ? readdirSync(migrationsDirPath) : []).map((entry) => entry.slice(0, 14)));

  let offset = 0;
  let timestamp = '';

  do {
    const date = new Date(startedAt + offset * 1000);

    timestamp = [
      date.getUTCFullYear(),
      (date.getUTCMonth() + 1).toString().padStart(2, '0'),
      date.getUTCDate().toString().padStart(2, '0'),
      date.getUTCHours().toString().padStart(2, '0'),
      date.getUTCMinutes().toString().padStart(2, '0'),
      date.getUTCSeconds().toString().padStart(2, '0'),
    ].join('');

    offset += 1;
  } while (takenTimestamps.has(timestamp));

  const dirName = [timestamp, ...(slug ? [slug] : [])].join('_');
  const dirPath = path.join(migrationsDirPath, dirName);

  await fs.mkdir(dirPath, { recursive: true });

  if (sqlStatements) {
    const sql = sqlStatements.join('\n\n----------------------------\n\n');

    await fs.writeFile(path.join(dirPath, 'migration.sql'), sql === '' ? '' : `${sql}\n`);
  }

  await fs.writeFile(path.join(dirPath, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);

  return { name: dirName, dirPath };
};
