import { match } from 'ts-pattern';

import { hasDB } from '#helpers/shared/has-db.ts';
import { readEnvFile } from '#helpers/shared/read-env-file.ts';

export const resolveDatabaseUrl = ({
  schemaFilePath,
  ...choice
}: {
  databaseUrl: string | undefined;
  devDatabase: boolean | undefined;
  prodDatabase: boolean | undefined;
  schemaFilePath: string;
}):
  | {
      url: string;
      source: string;
    }
  | undefined => {
  if (!hasDB(schemaFilePath)) {
    return undefined;
  }

  if (choice.databaseUrl !== undefined) {
    return { url: choice.databaseUrl, source: 'the --database-url option' };
  }

  const envKey = match(choice)
    .with({ devDatabase: true }, () => 'DATABASE_URL_DEV')
    .with({ prodDatabase: true }, () => 'DATABASE_URL')
    .otherwise(() => 'DATABASE_URL_LOCAL');

  const url = readEnvFile()[envKey];

  if (!url) {
    const message =
      envKey === 'DATABASE_URL_LOCAL'
        ? `No local database URL found. Set DATABASE_URL_LOCAL in .env, or choose another database with --database-url, --dev-database or --prod-database.`
        : `No database URL found in ${envKey}. Set it in .env, or pass one with --database-url.`;

    throw new Error(message);
  }

  return { url, source: envKey };
};
