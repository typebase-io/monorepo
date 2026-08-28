import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasMigrations } from '#helpers/shared/has-migrations.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('hasMigrations', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns true when the migrations directory exists', () => {
    const migrationsDirPath = tmp.mkdir('db/migrations');

    expect(hasMigrations(migrationsDirPath)).toBe(true);
  });

  it('returns true even while the directory is still empty', () => {
    tmp.mkdir('db/migrations');

    expect(hasMigrations(path.join(tmp.path, 'db/migrations'))).toBe(true);
  });

  it('returns false when the migrations directory is missing', () => {
    expect(hasMigrations(path.join(tmp.path, 'db/migrations'))).toBe(false);
  });
});
