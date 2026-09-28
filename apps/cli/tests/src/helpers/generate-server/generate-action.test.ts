import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateAction } from '#helpers/generate-server/generate-action.ts';
import type { ServerFeatures } from '#helpers/templates/server.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const CASES: { fixture: string; description: string; features: ServerFeatures }[] = [
  {
    fixture: 'storage.txt',
    description: 'an action with storage',
    features: { db: false, auth: false, env: false, publisher: false, storage: true },
  },
  {
    fixture: 'all-with-storage.txt',
    description: 'an action with every provider, storage included',
    features: { db: true, auth: true, env: true, publisher: true, storage: true },
  },
  {
    fixture: 'none.txt',
    description: 'an action with no providers',
    features: { db: false, auth: false, env: false, publisher: false, storage: false },
  },
  {
    fixture: 'db.txt',
    description: 'an action with a database',
    features: { db: true, auth: false, env: false, publisher: false, storage: false },
  },
  {
    fixture: 'auth.txt',
    description: 'an action with auth',
    features: { db: false, auth: true, env: false, publisher: false, storage: false },
  },
  {
    fixture: 'env.txt',
    description: 'an action with an env schema',
    features: { db: false, auth: false, env: true, publisher: false, storage: false },
  },
  {
    fixture: 'publisher.txt',
    description: 'an action with a publisher',
    features: { db: false, auth: false, env: false, publisher: true, storage: false },
  },
  {
    fixture: 'db-auth.txt',
    description: 'an action with a database and auth',
    features: { db: true, auth: true, env: false, publisher: false, storage: false },
  },
  {
    fixture: 'db-env.txt',
    description: 'an action with a database and an env schema',
    features: { db: true, auth: false, env: true, publisher: false, storage: false },
  },
  {
    fixture: 'db-publisher.txt',
    description: 'an action with a database and a publisher',
    features: { db: true, auth: false, env: false, publisher: true, storage: false },
  },
  {
    fixture: 'auth-env.txt',
    description: 'an action with auth and an env schema',
    features: { db: false, auth: true, env: true, publisher: false, storage: false },
  },
  {
    fixture: 'auth-publisher.txt',
    description: 'an action with auth and a publisher',
    features: { db: false, auth: true, env: false, publisher: true, storage: false },
  },
  {
    fixture: 'env-publisher.txt',
    description: 'an action with an env schema and a publisher',
    features: { db: false, auth: false, env: true, publisher: true, storage: false },
  },
  {
    fixture: 'db-auth-env.txt',
    description: 'an action with a database, auth and an env schema',
    features: { db: true, auth: true, env: true, publisher: false, storage: false },
  },
  {
    fixture: 'db-auth-publisher.txt',
    description: 'an action with a database, auth and a publisher',
    features: { db: true, auth: true, env: false, publisher: true, storage: false },
  },
  {
    fixture: 'db-env-publisher.txt',
    description: 'an action with a database, an env schema and a publisher',
    features: { db: true, auth: false, env: true, publisher: true, storage: false },
  },
  {
    fixture: 'auth-env-publisher.txt',
    description: 'an action with auth, an env schema and a publisher',
    features: { db: false, auth: true, env: true, publisher: true, storage: false },
  },
  {
    fixture: 'all.txt',
    description: 'an action with a database, auth, an env schema and a publisher',
    features: { db: true, auth: true, env: true, publisher: true, storage: false },
  },
];

describe('generateAction', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('creates the output directory tree even when it does not exist yet', async () => {
    const serverOutputDirPath = path.join(tmp.path, 'does', 'not', 'exist', 'src');

    await generateAction({ serverOutputDirPath, features: { db: true, auth: true, env: false, publisher: false, storage: false } });

    expect(fs.statSync(serverOutputDirPath).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(serverOutputDirPath, 'server.ts'))).toBe(true);
  });

  it.each(CASES)('writes $description', async ({ fixture, features }) => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), features });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', fixture);
  });
});
