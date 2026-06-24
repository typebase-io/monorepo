import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasDB } from '#helpers/shared/has-db.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('hasDB', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns true when the schema file exists', () => {
    const schemaPath = tmp.write('schema.ts', 'export const schema = {};');

    expect(hasDB(schemaPath)).toBe(true);
  });

  it('returns false when the schema file is missing', () => {
    expect(hasDB(path.join(tmp.path, 'schema.ts'))).toBe(false);
  });
});
