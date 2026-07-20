import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type ServerAdapter } from '#helpers/constants.ts';
import { generateDBFiles } from '#helpers/generate-server/generate-db-files.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('generateDBFiles', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const run = (useTs: boolean, adapter: ServerAdapter) => {
    tmp.write('db/schema.ts', 'export const schema = {};');

    return generateDBFiles({
      dbDirPath: path.join(tmp.path, 'db'),
      dbOutputDirPath: path.join(tmp.path, 'out'),
      useTs,
      adapter,
    });
  };

  it('creates the output directory and copies the db tree', async () => {
    tmp.write('db/schema.ts', 'export const schema = {};');

    const dbOutputDirPath = path.join(tmp.path, 'nested', 'out');

    await generateDBFiles({
      dbDirPath: path.join(tmp.path, 'db'),
      dbOutputDirPath,
      useTs: true,
      adapter: 'node',
    });

    expect(fs.statSync(dbOutputDirPath).isDirectory()).toBe(true);
    expect(tmp.exists('nested/out/schema.ts')).toBe(true);
  });

  describe('when using ts', () => {
    it('writes a .ts relations import and config for a non-cloudflare adapter', async () => {
      await run(true, 'node');

      expect(tmp.read('out/index.ts')).toEqualTemplate('generate-db-files', 'index-ts-node.txt');
      expect(tmp.read('out/drizzle.config.ts')).toEqualTemplate('generate-db-files', 'config-ts-node.txt');
    });

    it('writes a .ts relations import and config for the cloudflare adapter', async () => {
      await run(true, 'cloudflare');

      expect(tmp.read('out/index.ts')).toEqualTemplate('generate-db-files', 'index-ts-cloudflare.txt');
      expect(tmp.read('out/drizzle.config.ts')).toEqualTemplate('generate-db-files', 'config-ts-cloudflare.txt');
    });
  });

  describe('when not using ts', () => {
    it('writes a .js relations import and config for a non-cloudflare adapter', async () => {
      await run(false, 'node');

      expect(tmp.read('out/index.ts')).toEqualTemplate('generate-db-files', 'index-nots-node.txt');
      expect(tmp.read('out/drizzle.config.ts')).toEqualTemplate('generate-db-files', 'config-nots-node.txt');
    });

    it('writes a .js relations import and config for the cloudflare adapter', async () => {
      await run(false, 'cloudflare');

      expect(tmp.read('out/index.ts')).toEqualTemplate('generate-db-files', 'index-nots-cloudflare.txt');
      expect(tmp.read('out/drizzle.config.ts')).toEqualTemplate('generate-db-files', 'config-nots-cloudflare.txt');
    });
  });
});
