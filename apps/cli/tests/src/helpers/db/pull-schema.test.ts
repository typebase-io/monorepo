import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pullSchema } from '#helpers/db/pull-schema.ts';

vi.mock('node:child_process', () => {
  return { execFile: vi.fn() };
});

const getArgs = () => vi.mocked(execFile).mock.calls[0]?.[1] as string[];

const getOutDirPath = () => {
  const args = getArgs();

  return args[args.indexOf('--out') + 1] ?? '';
};

describe('pullSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(execFile).mockImplementation(((...callArgs: unknown[]) => {
      const outDirPath = getOutDirPath();

      fs.writeFileSync(path.join(outDirPath, 'schema.ts'), 'export const logs = pgTable("logs", {});\n');
      fs.writeFileSync(path.join(outDirPath, 'relations.ts'), 'export const relations = defineRelations(schema, (r) => ({}))');

      const cb = callArgs[callArgs.length - 1] as (error: unknown, result?: unknown) => void;

      cb(null, { stdout: '', stderr: '' });
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the schema with drizzle-kit and returns both generated files', async () => {
    const { schema, relations } = await pullSchema({ connectionUri: 'postgres://source/db' });

    expect(schema).toBe('export const logs = pgTable("logs", {});\n');
    expect(relations).toBe('export const relations = defineRelations(schema, (r) => ({}))');
  });

  it('runs drizzle-kit pull against the given database', async () => {
    await pullSchema({ connectionUri: 'postgres://source/db' });

    expect(getArgs()).toEqual([
      expect.stringMatching(/drizzle-kit[/\\]bin\.cjs$/),
      'pull',
      '--dialect',
      'postgresql',
      '--url',
      'postgres://source/db',
      '--out',
      expect.stringContaining('typebase-db-pull-'),
      '--introspect-casing',
      'camel',
    ]);
  });

  it('cleans up the directory drizzle-kit wrote to', async () => {
    await pullSchema({ connectionUri: 'postgres://source/db' });

    expect(fs.existsSync(getOutDirPath())).toBe(false);
  });

  it('reports what the database said when the pull fails', async () => {
    vi.mocked(execFile).mockImplementation(((...callArgs: unknown[]) => {
      const cb = callArgs[callArgs.length - 1] as (error: unknown) => void;

      cb(Object.assign(new Error('exited with code 1'), { stderr: 'password authentication failed', stdout: '' }));
    }) as never);

    await expect(pullSchema({ connectionUri: 'postgres://source/db' })).rejects.toThrow(
      'Could not read the schema from that database.\n\npassword authentication failed'
    );

    expect(fs.existsSync(getOutDirPath())).toBe(false);
  });

  it('still reports the failure when drizzle-kit said nothing', async () => {
    vi.mocked(execFile).mockImplementation(((...callArgs: unknown[]) => {
      const cb = callArgs[callArgs.length - 1] as (error: unknown) => void;

      cb(Object.assign(new Error('killed'), { stderr: '', stdout: '' }));
    }) as never);

    await expect(pullSchema({ connectionUri: 'postgres://source/db' })).rejects.toThrow('Could not read the schema from that database.');
  });
});
