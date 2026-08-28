import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildSchema } from '#helpers/db/build-schema.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('buildSchema', () => {
  let tmp: TempDir;
  let dbDirPath: string;

  beforeEach(async () => {
    tmp = createTempDir();

    linkTypebaseIo(tmp);

    const projectDir = await generateTypebaseProject(tmp);

    dbDirPath = path.join(projectDir, 'db');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('builds the schema to javascript and returns where it landed', async () => {
    const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider: 'vercel' });

    try {
      expect(fs.existsSync(path.join(serverDistDirPath, 'src', 'db', 'schema.js'))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('removes the temporary directory when cleanup is called', async () => {
    const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider: 'vercel' });

    await cleanup();

    expect(fs.existsSync(serverDistDirPath)).toBe(false);
  });

  it('leaves nothing behind when the build itself fails', async () => {
    tmp.write('typebase/db/schema.ts', 'export const broken = (');

    const before = fs.readdirSync(tmp.path);

    await expect(buildSchema({ dbDirPath, serverProvider: 'vercel' })).rejects.toThrow('The generated server contains syntax errors');

    expect(fs.readdirSync(tmp.path)).toEqual(before);
  });

  it.each([
    ['vercel', 'drizzle-orm/node-postgres'],
    ['deno', 'drizzle-orm/node-postgres'],
    ['cloudflare', 'drizzle-orm/neon-http'],
  ] as const)('builds with the adapter the %s provider implies', async (serverProvider, expectedDriver) => {
    const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider });

    try {
      expect(fs.readFileSync(path.join(serverDistDirPath, 'src', 'db', 'index.js'), 'utf8')).toContain(expectedDriver);
    } finally {
      await cleanup();
    }
  });

  it('falls back to the node-postgres driver when no provider is configured', async () => {
    const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider: undefined });

    try {
      expect(fs.readFileSync(path.join(serverDistDirPath, 'src', 'db', 'index.js'), 'utf8')).toContain('drizzle-orm/node-postgres');
    } finally {
      await cleanup();
    }
  });
});
