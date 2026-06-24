import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateExampleRelations } from '#helpers/init/generate-example-relations.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateExampleRelations', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('writes the relations template with auth relations when withAuth is true', async () => {
    await generateExampleRelations({ path: path.join(tmp.path, 'relations.ts'), withAuth: true });

    expect(tmp.read('relations.ts')).toEqualTemplate('generate-example-relations', 'with-auth.txt');
  });

  it('writes the relations template without auth relations when withAuth is false', async () => {
    await generateExampleRelations({ path: path.join(tmp.path, 'relations.ts'), withAuth: false });

    expect(tmp.read('relations.ts')).toEqualTemplate('generate-example-relations', 'without-auth.txt');
  });
});
