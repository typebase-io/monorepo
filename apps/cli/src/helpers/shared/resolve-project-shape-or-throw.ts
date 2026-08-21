import { type PublisherProvider } from '#helpers/constants.ts';
import { getPublisherProvider } from '#helpers/shared/get-publisher-provider.ts';
import { hasAuth } from '#helpers/shared/has-auth.ts';
import { hasDB } from '#helpers/shared/has-db.ts';
import { hasEnv } from '#helpers/shared/has-env.ts';
import { hasEventsTable } from '#helpers/shared/has-events-table.ts';
import { hasPublisher } from '#helpers/shared/has-publisher.ts';

export interface ProjectShape {
  hasDB: boolean;
  hasAuth: boolean;
  hasEnv: boolean;
  hasPublisher: false | PublisherProvider;
  needsEnvModule: boolean;
}

export const resolveProjectShapeOrThrow = ({
  schemaFilePath,
  authFilePath,
  envFilePath,
  publisherFilePath,
}: {
  schemaFilePath: string;
  authFilePath: string;
  envFilePath: string;
  publisherFilePath: string;
}): ProjectShape => {
  const includeDB = hasDB(schemaFilePath);
  const includeAuth = hasAuth(authFilePath);
  const includeEnv = hasEnv(envFilePath);
  const includePublisher = hasPublisher(publisherFilePath);
  const publisherProvider = includePublisher ? getPublisherProvider(publisherFilePath) : undefined;

  if (includeAuth && !includeDB) {
    throw new Error(
      'Found `auth.ts` but no database schema at `db/schema.ts`. better-auth keeps users and sessions in your database, so auth cannot be built without one. Create `db/schema.ts` and run `npx typebase-io-cli auth generate`, or remove `auth.ts`.'
    );
  }

  if (publisherProvider === 'db' && !includeDB) {
    throw new Error(
      'Found `publisher.ts` but no database schema at `db/schema.ts`. The `db` publisher keeps events in your database, so it cannot run without one. Create `db/schema.ts` and add the `events` table.'
    );
  }

  if (publisherProvider === 'db' && includeDB && !hasEventsTable(schemaFilePath)) {
    throw new Error('Found `publisher.ts` but `db/schema.ts` does not export the `events` table it keeps events in.');
  }

  return {
    hasDB: includeDB,
    hasAuth: includeAuth,
    hasEnv: includeEnv,
    hasPublisher: publisherProvider ?? false,
    needsEnvModule: includeDB || includeAuth || includeEnv,
  };
};
