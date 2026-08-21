import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type ProjectShape, resolveProjectShapeOrThrow } from '#helpers/shared/resolve-project-shape-or-throw.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

interface Files {
  hasDB: boolean;
  hasAuth: boolean;
  hasEnv: boolean;
  hasPublisher: boolean;
}

const RESOLVED_CASES: (Files & { description: string; expected: ProjectShape })[] = [
  {
    description: 'a project with nothing in it',
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
    expected: { hasDB: false, hasAuth: false, hasEnv: false, hasPublisher: false, needsEnvModule: false },
  },
  {
    description: 'a project with only a database',
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
    expected: { hasDB: true, hasAuth: false, hasEnv: false, hasPublisher: false, needsEnvModule: true },
  },
  {
    description: 'a project with only an env schema',
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
    expected: { hasDB: false, hasAuth: false, hasEnv: true, hasPublisher: false, needsEnvModule: true },
  },
  {
    description: 'a project with a database and auth',
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
    expected: { hasDB: true, hasAuth: true, hasEnv: false, hasPublisher: false, needsEnvModule: true },
  },
  {
    description: 'a project with a database and an env schema',
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
    expected: { hasDB: true, hasAuth: false, hasEnv: true, hasPublisher: false, needsEnvModule: true },
  },
  {
    description: 'a project with a database and a publisher',
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
    expected: { hasDB: true, hasAuth: false, hasEnv: false, hasPublisher: 'db', needsEnvModule: true },
  },
  {
    description: 'a project with a database, auth and an env schema',
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
    expected: { hasDB: true, hasAuth: true, hasEnv: true, hasPublisher: false, needsEnvModule: true },
  },
  {
    description: 'a project with a database, auth and a publisher',
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
    expected: { hasDB: true, hasAuth: true, hasEnv: false, hasPublisher: 'db', needsEnvModule: true },
  },
  {
    description: 'a project with a database, an env schema and a publisher',
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
    expected: { hasDB: true, hasAuth: false, hasEnv: true, hasPublisher: 'db', needsEnvModule: true },
  },
  {
    description: 'a project with a database, auth, an env schema and a publisher',
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
    expected: { hasDB: true, hasAuth: true, hasEnv: true, hasPublisher: 'db', needsEnvModule: true },
  },
];

const REFUSED_CASES: (Files & { description: string; error: string })[] = [
  {
    description: 'a project with only auth',
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with only a publisher',
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
    error: 'Found `publisher.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with auth and an env schema',
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with auth and a publisher',
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with an env schema and a publisher',
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
    error: 'Found `publisher.ts` but no database schema at `db/schema.ts`',
  },
  {
    description: 'a project with auth, an env schema and a publisher',
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
    error: 'Found `auth.ts` but no database schema at `db/schema.ts`',
  },
];

const DB_PUBLISHER = removeExtraSpaces(`
  import { definePublisher } from "typebase-io/server";

  export const publisher = definePublisher({ provider: "db", events: {} });
`);

describe('resolveProjectShapeOrThrow', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const writeProject = ({ hasDB, hasAuth, hasEnv, hasPublisher }: Files) => {
    if (hasDB) {
      tmp.write('db/schema.ts', hasPublisher ? 'export const todos = {};\nexport { events } from "typebase-io/db";' : 'export const todos = {};');
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
    resolveProjectShapeOrThrow({
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      envFilePath: path.join(tmp.path, 'env.ts'),
      publisherFilePath: path.join(tmp.path, 'publisher.ts'),
    });

  it.each(RESOLVED_CASES)('reports $description', ({ hasDB, hasAuth, hasEnv, hasPublisher, expected }) => {
    writeProject({ hasDB, hasAuth, hasEnv, hasPublisher });

    expect(run()).toEqual(expected);
  });

  it.each(REFUSED_CASES)('refuses $description', ({ hasDB, hasAuth, hasEnv, hasPublisher, error }) => {
    writeProject({ hasDB, hasAuth, hasEnv, hasPublisher });

    expect(() => run()).toThrow(error);
  });

  it('points at both ways out when it refuses auth without a database', () => {
    writeProject({ hasDB: false, hasAuth: true, hasEnv: false, hasPublisher: false });

    expect(() => run()).toThrow('run `npx typebase-io-cli auth generate`, or remove `auth.ts`');
  });

  it('refuses a db publisher whose schema has no events table, since the next push would drop it', () => {
    tmp.write('db/schema.ts', 'export const todos = {};');
    tmp.write('publisher.ts', DB_PUBLISHER);

    expect(() => run()).toThrow('does not export the `events` table');
  });

  it('refuses a provider Typebase does not have', () => {
    tmp.write('db/schema.ts', 'export { events } from "typebase-io/db";');
    tmp.write('publisher.ts', 'export const publisher = definePublisher({ provider: "redis", events: {} });');

    expect(() => run()).toThrow('asks for the `redis` publisher, which Typebase does not have');
  });

  it('refuses a provider it cannot read from the file', () => {
    tmp.write('db/schema.ts', 'export { events } from "typebase-io/db";');
    tmp.write('publisher.ts', 'export const publisher = definePublisher({ provider: chosen, events: {} });');

    expect(() => run()).toThrow('Could not read which publisher `publisher.ts` asks for');
  });
});
