import fs from 'node:fs';
import path from 'node:path';

import { confirm, input, select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '#commands/db.ts';

import { neon } from '#helpers/db/neon/index.ts';
import { pullSchema } from '#helpers/db/pull-schema.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { readPulledSource } from '#tests/helpers/read-pulled-source.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/db/neon/index.ts', () => ({ neon: vi.fn() }));
vi.mock('#helpers/db/push-schema.ts', () => ({ pushSchema: vi.fn() }));
vi.mock('#helpers/db/pull-schema.ts', () => ({ pullSchema: vi.fn() }));

// eslint-disable-next-line no-control-regex
const stripColours = (line: string) => line.replaceAll(/\u001B\[\d+(?:;\d+)*m/g, '');

const readLog = () =>
  `${vi
    .mocked(console.log)
    .mock.calls.map(([line]) => stripColours(String(line)))
    .join('\n')
    .trim()}\n`;

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

    vi.mocked(pullSchema).mockResolvedValue({
      schema: readPulledSource('schema.ts.txt'),
      relations: readPulledSource('relations.ts.txt'),
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

  describe('pull', () => {
    it('writes the pulled database to schema.ts and relations.ts', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(pullSchema).toHaveBeenCalledWith({ connectionUri: 'postgres://source/db' });
      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'schema.ts.txt');
      expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('db-pull', 'relations.ts.txt');
    });

    it('regenerates the types for the pulled schema', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(tmp.exists('typebase/_generated/db.d.ts')).toBe(true);
      expect(tmp.exists('typebase/_generated/server.ts')).toBe(true);
    });

    it('explains what was written and what to run next', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(readLog()).toEqualTemplate('db-pull', 'output.txt');
    });

    it('keeps a publisher project working when the database it reads already holds the events table', async () => {
      await generateTypebaseProject(tmp, { withPublisher: true });

      vi.mocked(pullSchema).mockResolvedValue({
        schema: readPulledSource('events-schema.ts.txt'),
        relations: readPulledSource('events-relations.ts.txt'),
      });

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'events-schema.ts.txt');
      expect(tmp.read('typebase/_generated/server.ts')).toEqualTemplate('db-pull', 'events-server.ts.txt');
    });

    it('refuses to leave a publisher project without the events table it needs', async () => {
      await generateTypebaseProject(tmp, { withPublisher: true });

      await expect(withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }))).rejects.toThrow(
        'does not export the `events` table'
      );
    });

    it('prompts for the connection string when --url is omitted', async () => {
      vi.mocked(input).mockResolvedValue('  postgres://prompted/db  ');

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--force'], { from: 'user' }));

      expect(input).toHaveBeenCalledOnce();
      expect(pullSchema).toHaveBeenCalledWith({ connectionUri: 'postgres://prompted/db' });
    });

    it('rejects an empty connection string at the prompt', async () => {
      vi.mocked(input).mockResolvedValue('postgres://prompted/db');

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--force'], { from: 'user' }));

      const { validate } = vi.mocked(input).mock.calls[0]?.[0] ?? {};

      expect(validate?.('')).toBe('A connection string is required.');
      expect(validate?.('   ')).toBe('A connection string is required.');
      expect(validate?.('postgres://source/db')).toBe(true);
    });

    it('asks before replacing existing db files', async () => {
      vi.mocked(confirm).mockResolvedValue(true);

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db'], { from: 'user' }));

      expect(confirm).toHaveBeenCalledOnce();
      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'schema.ts.txt');
    });

    it('leaves the auth warning out of the prompt when the project has no auth', async () => {
      fs.rmSync(path.join(tmp.path, 'typebase/auth.ts'));
      vi.mocked(confirm).mockResolvedValue(false);

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db'], { from: 'user' }));

      expect(readLog()).toEqualTemplate('db-pull', 'overwrite-prompt.txt');
    });

    it('writes nothing when the prompt is declined', async () => {
      vi.mocked(confirm).mockResolvedValue(false);

      const schemaBefore = tmp.read('typebase/db/schema.ts');

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db'], { from: 'user' }));

      expect(pullSchema).not.toHaveBeenCalled();
      expect(tmp.read('typebase/db/schema.ts')).toBe(schemaBefore);
    });

    it('skips the prompt when --force is passed', async () => {
      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(confirm).not.toHaveBeenCalled();
    });

    it('does not ask when there is nothing to replace', async () => {
      fs.rmSync(path.join(tmp.path, 'typebase/db'), { recursive: true });

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db'], { from: 'user' }));

      expect(confirm).not.toHaveBeenCalled();
      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'schema.ts.txt');
    });

    it('leaves the project alone when the database has no tables', async () => {
      const schemaBefore = tmp.read('typebase/db/schema.ts');

      vi.mocked(pullSchema).mockResolvedValue({
        schema: readPulledSource('empty-schema.ts.txt'),
        relations: readPulledSource('empty-relations.ts.txt'),
      });

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(tmp.read('typebase/db/schema.ts')).toBe(schemaBefore);
    });

    it('warns about tables pulled in from another schema', async () => {
      vi.mocked(pullSchema).mockResolvedValue({
        schema: readPulledSource('cross-schema-schema.ts.txt'),
        relations: readPulledSource('cross-schema-relations.ts.txt'),
      });

      await withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }));

      expect(tmp.read('typebase/db/schema.ts')).toEqualTemplate('db-pull', 'cross-schema', 'schema.ts.txt');
      expect(tmp.read('typebase/db/relations.ts')).toEqualTemplate('db-pull', 'cross-schema', 'relations.ts.txt');
      expect(readLog()).toEqualTemplate('db-pull', 'cross-schema', 'output.txt');
    });

    it('throws when the project has not been initialized', async () => {
      fs.rmSync(path.join(tmp.path, 'typebase/tsconfig.json'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }))).rejects.toThrow(
        'No Typebase project found at `typebase`. Run `init` first.'
      );

      expect(pullSchema).not.toHaveBeenCalled();
    });

    it('names the current directory when the project lives in it', async () => {
      tmp.write('typebase.json', JSON.stringify({ projectPath: '.' }));

      await expect(withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }))).rejects.toThrow(
        'No Typebase project found at `.`. Run `init` first.'
      );
    });

    it('propagates a failure from pullSchema', async () => {
      vi.mocked(pullSchema).mockRejectedValueOnce(new Error('could not connect'));

      await expect(withCwd(tmp.path, () => db.parseAsync(['pull', '--url', 'postgres://source/db', '--force'], { from: 'user' }))).rejects.toThrow(
        'could not connect'
      );
    });
  });
});
