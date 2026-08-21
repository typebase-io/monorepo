import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateAction } from '#helpers/generate-server/generate-action.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const CASES: { fixture: string; description: string; hasDB: boolean; hasAuth: boolean; hasEnv: boolean; hasPublisher: boolean }[] = [
  {
    fixture: 'none.txt',
    description: 'an action with no providers',
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
  },
  {
    fixture: 'db.txt',
    description: 'an action with a database',
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: false,
  },
  {
    fixture: 'auth.txt',
    description: 'an action with auth',
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
  },
  {
    fixture: 'env.txt',
    description: 'an action with an env schema',
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
  },
  {
    fixture: 'publisher.txt',
    description: 'an action with a publisher',
    hasDB: false,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
  },
  {
    fixture: 'db-auth.txt',
    description: 'an action with a database and auth',
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: false,
  },
  {
    fixture: 'db-env.txt',
    description: 'an action with a database and an env schema',
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: false,
  },
  {
    fixture: 'db-publisher.txt',
    description: 'an action with a database and a publisher',
    hasDB: true,
    hasAuth: false,
    hasEnv: false,
    hasPublisher: true,
  },
  {
    fixture: 'auth-env.txt',
    description: 'an action with auth and an env schema',
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
  },
  {
    fixture: 'auth-publisher.txt',
    description: 'an action with auth and a publisher',
    hasDB: false,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
  },
  {
    fixture: 'env-publisher.txt',
    description: 'an action with an env schema and a publisher',
    hasDB: false,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
  },
  {
    fixture: 'db-auth-env.txt',
    description: 'an action with a database, auth and an env schema',
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: false,
  },
  {
    fixture: 'db-auth-publisher.txt',
    description: 'an action with a database, auth and a publisher',
    hasDB: true,
    hasAuth: true,
    hasEnv: false,
    hasPublisher: true,
  },
  {
    fixture: 'db-env-publisher.txt',
    description: 'an action with a database, an env schema and a publisher',
    hasDB: true,
    hasAuth: false,
    hasEnv: true,
    hasPublisher: true,
  },
  {
    fixture: 'auth-env-publisher.txt',
    description: 'an action with auth, an env schema and a publisher',
    hasDB: false,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
  },
  {
    fixture: 'all.txt',
    description: 'an action with a database, auth, an env schema and a publisher',
    hasDB: true,
    hasAuth: true,
    hasEnv: true,
    hasPublisher: true,
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

    await generateAction({ serverOutputDirPath, hasDB: true, hasAuth: true, hasEnv: false, hasPublisher: false });

    expect(fs.statSync(serverOutputDirPath).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(serverOutputDirPath, 'server.ts'))).toBe(true);
  });

  it.each(CASES)('writes $description', async ({ fixture, hasDB, hasAuth, hasEnv, hasPublisher }) => {
    await generateAction({ serverOutputDirPath: path.join(tmp.path, 'src'), hasDB, hasAuth, hasEnv, hasPublisher });

    expect(tmp.read('src/server.ts')).toEqualTemplate('generate-action', fixture);
  });
});
