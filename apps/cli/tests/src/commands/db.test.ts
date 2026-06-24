import fs from 'node:fs';
import path from 'node:path';

import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '#commands/db.ts';

import { neon } from '#helpers/db/neon/index.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/db/neon/index.ts', () => ({ neon: vi.fn() }));
vi.mock('#helpers/db/push-schema.ts', () => ({ pushSchema: vi.fn() }));

describe('db command', () => {
  let tmp: TempDir;
  let builtSchemaExistedAtPush: boolean;

  beforeEach(async () => {
    vi.clearAllMocks();

    delete process.env.DATABASE_URL;

    tmp = createTempDir();

    linkTypebaseIo(tmp);

    await generateTypebaseProject(tmp);

    builtSchemaExistedAtPush = false;

    vi.mocked(neon).mockResolvedValue({
      projectId: 'proj-1',
      branchId: 'br-1',
      connectionUri: 'postgres://neon/db',
    });

    vi.mocked(pushSchema).mockImplementation(({ serverDistDirPath }) => {
      builtSchemaExistedAtPush = fs.existsSync(path.join(serverDistDirPath, 'src', 'db', 'schema.js'));

      return Promise.resolve();
    });

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;

    delete process.env.DATABASE_URL;

    vi.restoreAllMocks();
  });

  describe('dev / prod push', () => {
    it('builds the schema and pushes it to the neon dev branch', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      await withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }));

      expect(select).not.toHaveBeenCalled();
      expect(neon).toHaveBeenCalledWith({ target: 'dev' });
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://neon/db' }));
      expect(builtSchemaExistedAtPush).toBe(true);
    });

    it('targets the prod branch for the prod subcommand', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'deno' }));

      await withCwd(tmp.path, () => db.parseAsync(['prod', 'push'], { from: 'user' }));

      expect(neon).toHaveBeenCalledWith({ target: 'prod' });
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://neon/db' }));
    });

    it('does not modify the configured provider', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      await withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }));

      expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ serverProvider: 'vercel' });
    });

    it('prompts for the provider and persists it to typebase.json when none is configured', async () => {
      vi.mocked(select).mockResolvedValue('cloudflare');

      await withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }));

      expect(select).toHaveBeenCalledOnce();
      expect(tmp.exists('typebase.json')).toBe(true);
      expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ serverProvider: 'cloudflare' });
      expect(neon).toHaveBeenCalledWith({ target: 'dev' });
    });

    it('throws and never contacts neon when there is no database schema', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }))).rejects.toThrow(
        'No database schema found. Create a schema file at db/schema.ts.'
      );

      expect(neon).not.toHaveBeenCalled();
      expect(pushSchema).not.toHaveBeenCalled();
    });

    it('propagates a failure from pushSchema', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'vercel' }));

      vi.mocked(pushSchema).mockRejectedValueOnce(new Error('db unreachable'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['dev', 'push'], { from: 'user' }))).rejects.toThrow('db unreachable');
    });
  });

  describe('local push', () => {
    it('builds and pushes using the --url flag without contacting neon', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['local', 'push', '--url', 'postgres://local/db'], { from: 'user' }));

      expect(select).not.toHaveBeenCalled();
      expect(neon).not.toHaveBeenCalled();
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://local/db' }));
      expect(builtSchemaExistedAtPush).toBe(true);
    });

    it('falls back to DATABASE_URL from the environment', async () => {
      process.env.DATABASE_URL = 'postgres://env/db';

      await withCwd(tmp.path, () => db.parseAsync(['local', 'push'], { from: 'user' }));

      expect(neon).not.toHaveBeenCalled();
      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://env/db' }));
    });

    it('reads DATABASE_URL from the .env file', async () => {
      tmp.write('.env', 'DATABASE_URL=postgres://file/db\n');

      await withCwd(tmp.path, () => db.parseAsync(['local', 'push'], { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://file/db' }));
    });

    it.each(['vercel', 'deno', 'cloudflare'] as const)(
      'builds the schema with the %s adapter when that provider is configured',
      async (serverProvider) => {
        tmp.write('typebase.json', JSON.stringify({ serverProvider }));

        await withCwd(tmp.path, () => db.parseAsync(['local', 'push', '--url', 'postgres://local/db'], { from: 'user' }));

        expect(select).not.toHaveBeenCalled();
        expect(neon).not.toHaveBeenCalled();
        expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://local/db' }));
        expect(builtSchemaExistedAtPush).toBe(true);
      }
    );

    it('throws when no database url can be resolved', async () => {
      await expect(withCwd(tmp.path, () => db.parseAsync(['local', 'push'], { from: 'user' }))).rejects.toThrow(
        'No database URL provided. Pass --url or set DATABASE_URL.'
      );

      expect(pushSchema).not.toHaveBeenCalled();
    });

    it('throws when there is no database schema', async () => {
      fs.rmSync(path.join(tmp.path, 'typebase/db/schema.ts'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['local', 'push', '--url', 'postgres://local/db'], { from: 'user' }))).rejects.toThrow(
        'No database schema found. Create a schema file at db/schema.ts.'
      );

      expect(pushSchema).not.toHaveBeenCalled();
    });
  });
});
