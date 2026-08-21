import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

interface Files {
  hasRouter: boolean;
  hasDB: boolean;
  hasAuth: boolean;
  hasEnv: boolean;
  hasPublisher: boolean;
}

const RESOLVED_CASES: (Files & { description: string; fixture: string })[] = [
  {
    description: 'a project with nothing in it',
    hasRouter: false,
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
    fixture: 'none.txt',
  },
  {
    description: 'a project with only actions',
    hasRouter: true,
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
    fixture: 'router.txt',
  },
  {
    description: 'a project with only a database',
    hasRouter: false,
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
    fixture: 'db.txt',
  },
  {
    description: 'a project with only an env schema',
    hasRouter: false,
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
    fixture: 'env.txt',
  },
  {
    description: 'a project with actions and a database',
    hasRouter: true,
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
    fixture: 'router-db.txt',
  },
  {
    description: 'a project with actions and an env schema',
    hasRouter: true,
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
    fixture: 'router-env.txt',
  },
  {
    description: 'a project with a database and auth',
    hasRouter: false,
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
    fixture: 'db-auth.txt',
  },
  {
    description: 'a project with a database and an env schema',
    hasRouter: false,
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
    fixture: 'db-env.txt',
  },
  {
    description: 'a project with a database and a publisher',
    hasRouter: false,
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
    fixture: 'db-publisher.txt',
  },
  {
    description: 'a project with actions, a database and auth',
    hasRouter: true,
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
    fixture: 'router-db-auth.txt',
  },
  {
    description: 'a project with actions, a database and an env schema',
    hasRouter: true,
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
    fixture: 'router-db-env.txt',
  },
  {
    description: 'a project with actions, a database and a publisher',
    hasRouter: true,
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
    fixture: 'router-db-publisher.txt',
  },
  {
    description: 'a project with a database, auth and an env schema',
    hasRouter: false,
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
    fixture: 'db-auth-env.txt',
  },
  {
    description: 'a project with a database, auth and a publisher',
    hasRouter: false,
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
    fixture: 'db-auth-publisher.txt',
  },
  {
    description: 'a project with a database, an env schema and a publisher',
    hasRouter: false,
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
    fixture: 'db-env-publisher.txt',
  },
  {
    description: 'a project with actions, a database, auth and an env schema',
    hasRouter: true,
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
    fixture: 'router-db-auth-env.txt',
  },
  {
    description: 'a project with actions, a database, auth and a publisher',
    hasRouter: true,
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
    fixture: 'router-db-auth-publisher.txt',
  },
  {
    description: 'a project with actions, a database, an env schema and a publisher',
    hasRouter: true,
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
    fixture: 'router-db-env-publisher.txt',
  },
  {
    description: 'a project with a database, auth, an env schema and a publisher',
    hasRouter: false,
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
    fixture: 'db-auth-env-publisher.txt',
  },
  {
    description: 'a project with actions, a database, auth, an env schema and a publisher',
    hasRouter: true,
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
    fixture: 'all.txt',
  },
];

const REFUSED_CASES: (Files & { description: string; error: string })[] = [
  {
    description: 'a project with only auth',
    hasRouter: false,
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with only a publisher',
    hasRouter: false,
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
    error: 'Found `publisher.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with actions and auth',
    hasRouter: true,
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with actions and a publisher',
    hasRouter: true,
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
    error: 'Found `publisher.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with auth and an env schema',
    hasRouter: false,
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with auth and a publisher',
    hasRouter: false,
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with an env schema and a publisher',
    hasRouter: false,
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
    error: 'Found `publisher.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with actions, auth and an env schema',
    hasRouter: true,
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with actions, auth and a publisher',
    hasRouter: true,
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with actions, an env schema and a publisher',
    hasRouter: true,
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
    error: 'Found `publisher.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with auth, an env schema and a publisher',
    hasRouter: false,
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with actions, auth, an env schema and a publisher',
    hasRouter: true,
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
];

const TS_CONFIG = JSON.stringify({
  compilerOptions: { strict: true, skipLibCheck: true, noEmit: true, target: 'ESNext' },
  include: ['./**/*.ts'],
});

const DB_PUBLISHER = removeExtraSpaces(`
  import { definePublisher } from "typebase-io/server";

  export const publisher = definePublisher({ provider: "db", events: {} });
`);

describe('generateServerTypes', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const writeProject = ({ hasRouter, hasDB, hasAuth, hasEnv, hasPublisher }: Files) => {
    tmp.write('tsconfig.json', TS_CONFIG);

    if (hasRouter) {
      tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);
    }

    if (hasDB) {
      tmp.write('db/schema.ts', hasPublisher ? 'export const schema = {};\nexport { events } from "typebase-io/db";' : 'export const schema = {};');
    }

    if (hasAuth) {
      tmp.write('auth.ts', 'export const auth = {};');
    }

    if (hasEnv) {
      tmp.write('env.ts', 'export const env = {};');
    }

    if (hasPublisher) {
      tmp.write('publisher.ts', DB_PUBLISHER);
    }
  };

  const run = () =>
    generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      publisherFilePath: path.join(tmp.path, 'publisher.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

  it.each(RESOLVED_CASES)('writes the types for $description', async ({ fixture, ...files }) => {
    writeProject(files);

    await run();

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', fixture);
  });

  it.each(REFUSED_CASES)('refuses $description', async ({ error, ...files }) => {
    writeProject(files);

    await expect(run()).rejects.toThrow(error);
  });
});
