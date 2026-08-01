import { hasAuth } from '#helpers/shared/has-auth.ts';
import { hasDB } from '#helpers/shared/has-db.ts';
import { hasEnv } from '#helpers/shared/has-env.ts';

export interface ProjectShape {
  hasDB: boolean;
  hasAuth: boolean;
  hasEnv: boolean;
  needsEnvModule: boolean;
}

export const resolveProjectShapeOrThrow = ({
  schemaFilePath,
  authFilePath,
  envFilePath,
}: {
  schemaFilePath: string;
  authFilePath: string;
  envFilePath: string;
}): ProjectShape => {
  const includeDB = hasDB(schemaFilePath);
  const includeAuth = hasAuth(authFilePath);
  const includeEnv = hasEnv(envFilePath);

  if (includeAuth && !includeDB) {
    throw new Error(
      'Found `auth.ts` but no database schema at `db/schema.ts`. better-auth keeps users and sessions in your database, so auth cannot be built without one. Create `db/schema.ts` and run `npx typebase-io-cli auth generate`, or remove `auth.ts`.'
    );
  }

  return {
    hasDB: includeDB,
    hasAuth: includeAuth,
    hasEnv: includeEnv,
    needsEnvModule: includeDB || includeAuth || includeEnv,
  };
};
