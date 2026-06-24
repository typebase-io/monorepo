import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateDBTypes', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('does nothing when there is no schema file', async () => {
    const outFilePath = path.join(tmp.path, 'generated', 'db.ts');

    await generateDBTypes({
      schemaFilePath: path.join(tmp.path, 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      outFilePath,
    });

    expect(fs.existsSync(outFilePath)).toBe(false);
  });

  it('removes a stale output file when the schema is gone', async () => {
    const outFilePath = tmp.write('generated/db.ts', 'stale');

    await generateDBTypes({
      schemaFilePath: path.join(tmp.path, 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      outFilePath,
    });

    expect(fs.existsSync(outFilePath)).toBe(false);
  });

  it('writes db types with a "./"-prefixed schema import and auth session', async () => {
    tmp.write('schema.ts', 'export const x = 1;');
    tmp.write('auth.ts', 'export const auth = {};');

    const outFilePath = path.join(tmp.path, 'db-types.ts');

    await generateDBTypes({
      schemaFilePath: path.join(tmp.path, 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      outFilePath,
    });

    expect(tmp.read('db-types.ts')).toEqualTemplate('generate-db-types', 'with-auth.txt');
  });

  it('keeps a parent-relative schema import and omits auth types when there is no auth file', async () => {
    tmp.write('schema.ts', 'export const x = 1;');

    const outFilePath = path.join(tmp.path, 'generated', 'db-types.ts');

    await generateDBTypes({
      schemaFilePath: path.join(tmp.path, 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      outFilePath,
    });

    expect(fs.readFileSync(outFilePath, 'utf8')).toEqualTemplate('generate-db-types', 'parent-relative-no-auth.txt');
  });
});
