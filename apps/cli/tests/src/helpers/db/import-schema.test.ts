import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildSchema } from '#helpers/db/build-schema.ts';
import { importSchema } from '#helpers/db/import-schema.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('importSchema', () => {
  let tmp: TempDir;
  let dbDirPath: string;

  beforeEach(async () => {
    tmp = createTempDir();

    linkTypebaseIo(tmp);

    const projectDir = await generateTypebaseProject(tmp, { withAuth: false });

    dbDirPath = path.join(projectDir, 'db');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('returns the tables the built schema exports', async () => {
    await withCwd(tmp.path, async () => {
      const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider: 'vercel' });

      try {
        expect(Object.keys(await importSchema({ serverDistDirPath }))).toContain('todos');
      } finally {
        await cleanup();
      }
    });
  });

  it('leaves the node_modules symlink inside the build directory so cleanup removes it', async () => {
    await withCwd(tmp.path, async () => {
      const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider: 'vercel' });

      await importSchema({ serverDistDirPath });

      expect(fs.lstatSync(path.join(serverDistDirPath, 'node_modules')).isSymbolicLink()).toBe(true);

      await cleanup();

      expect(fs.existsSync(serverDistDirPath)).toBe(false);
      expect(fs.existsSync(path.join(tmp.path, 'node_modules'))).toBe(true);
    });
  });

  it('reuses a symlink that is already there instead of recreating it', async () => {
    await withCwd(tmp.path, async () => {
      const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider: 'vercel' });

      try {
        const symlinkPath = path.join(serverDistDirPath, 'node_modules');

        fs.symlinkSync(path.join(tmp.path, 'node_modules'), symlinkPath);

        const before = fs.readlinkSync(symlinkPath);

        expect(Object.keys(await importSchema({ serverDistDirPath }))).toContain('todos');
        expect(fs.readlinkSync(symlinkPath)).toBe(before);
      } finally {
        await cleanup();
      }
    });
  });
});
