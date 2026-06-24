import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateServerTypes', () => {
  let tmp: TempDir;

  const TS_CONFIG = JSON.stringify({
    compilerOptions: { strict: true, skipLibCheck: true, noEmit: true, target: 'ESNext' },
    include: ['./**/*.ts'],
  });

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('includes db and auth declarations and the action router when both exist', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('db/schema.ts', 'export const schema = {};');
    tmp.write('auth.ts', 'export const auth = {};');
    tmp.write('actions/hello.ts', `export const hello = { '~orpc': {} as unknown };`);

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'with-db-auth.txt');
  });

  it('omits db and auth declarations when neither schema nor auth exist', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.mkdir('actions');

    await generateServerTypes({
      tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
      schemaFilePath: path.join(tmp.path, 'db', 'schema.ts'),
      authFilePath: path.join(tmp.path, 'auth.ts'),
      actionsDirPath: path.join(tmp.path, 'actions'),
      generatedDirPath: path.join(tmp.path, 'generated'),
    });

    expect(tmp.read('generated/server.ts')).toEqualTemplate('generate-server-types', 'without-db-auth.txt');
  });
});
