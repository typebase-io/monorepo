import { confirm } from '@inquirer/prompts';
import { pushSchema as drizzlePush } from 'drizzle-kit/api-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pushSchema } from '#helpers/db/push-schema.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const dbMocks = vi.hoisted(() => ({
  client: {
    end: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('drizzle-kit/api-postgres', () => ({
  pushSchema: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({ $client: dbMocks.client })),
}));

const writeServerSchema = (tmp: TempDir) => {
  const serverDistDirPath = tmp.mkdir('server-dist');

  tmp.write('server-dist/package.json', '{"type":"module"}\n');
  tmp.write('server-dist/src/db/schema.js', 'export const users = { tableName: "users" };\n');

  return serverDistDirPath;
};

const mockDrizzlePush = ({
  sqlStatements = [],
  hints = [],
  apply = vi.fn(),
}: {
  sqlStatements?: string[];
  hints?: { hint: string }[];
  apply?: () => Promise<void> | void;
}) => {
  vi.mocked(drizzlePush).mockResolvedValue({ sqlStatements, hints, apply } as never);

  return { apply };
};

describe('pushSchema', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    vi.clearAllMocks();
    dbMocks.client.end.mockResolvedValue(undefined);
    vi.mocked(confirm).mockReset();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('creates a node_modules symlink, analyzes the schema, and cleans up when there are no changes', async () => {
    const serverDistDirPath = writeServerSchema(tmp);
    const { apply } = mockDrizzlePush({});

    await pushSchema({ serverDistDirPath, connectionUri: 'postgres://user:pass@localhost/db' });

    expect(drizzle).toHaveBeenCalledWith('postgres://user:pass@localhost/db');
    expect(dbMocks.client.on).toHaveBeenCalledWith('error', expect.any(Function));

    const errorHandler = dbMocks.client.on.mock.calls[0]?.[1] as (() => void) | undefined;

    expect(errorHandler?.()).toBeUndefined();
    expect(drizzlePush).toHaveBeenCalledWith(expect.objectContaining({ users: { tableName: 'users' } }), { $client: dbMocks.client }, 'snake_case');
    expect(apply).not.toHaveBeenCalled();
    expect(dbMocks.client.end).toHaveBeenCalledOnce();
    expect(tmp.exists('server-dist/node_modules')).toBe(false);
  });

  it('keeps an existing node_modules directory and applies schema changes without confirmation when there are no hints', async () => {
    const serverDistDirPath = writeServerSchema(tmp);

    tmp.mkdir('server-dist/node_modules');

    const { apply } = mockDrizzlePush({ sqlStatements: ['create table users (id integer);'] });

    await pushSchema({ serverDistDirPath, connectionUri: 'postgres://user:pass@localhost/db' });

    expect(confirm).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledOnce();
    expect(dbMocks.client.end).toHaveBeenCalledOnce();
    expect(tmp.exists('server-dist/node_modules')).toBe(true);
  });

  it('prints schema warnings and applies changes after confirmation', async () => {
    const serverDistDirPath = writeServerSchema(tmp);

    const { apply } = mockDrizzlePush({
      sqlStatements: ['drop table users;'],
      hints: [{ hint: 'You are about to drop users.' }, { hint: 'This may delete data.' }],
    });

    vi.mocked(confirm).mockResolvedValue(true);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await pushSchema({ serverDistDirPath, connectionUri: 'postgres://user:pass@localhost/db' });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Warnings:'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('You are about to drop users.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('This may delete data.'));
    expect(confirm).toHaveBeenCalledWith({ message: 'Apply these changes?' });
    expect(apply).toHaveBeenCalledOnce();
    expect(dbMocks.client.end).toHaveBeenCalledOnce();
    expect(tmp.exists('server-dist/node_modules')).toBe(false);
  });

  it('throws and skips apply when warning confirmation is rejected', async () => {
    const serverDistDirPath = writeServerSchema(tmp);

    const { apply } = mockDrizzlePush({
      sqlStatements: ['drop table users;'],
      hints: [{ hint: 'You are about to drop users.' }],
    });

    vi.mocked(confirm).mockResolvedValue(false);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(pushSchema({ serverDistDirPath, connectionUri: 'postgres://user:pass@localhost/db' })).rejects.toThrow(
      'Schema push cancelled. Deploy aborted.'
    );

    expect(apply).not.toHaveBeenCalled();
    expect(dbMocks.client.end).toHaveBeenCalledOnce();
    expect(tmp.exists('server-dist/node_modules')).toBe(false);
  });

  it('ends the database client and removes the symlink when applying changes fails', async () => {
    const serverDistDirPath = writeServerSchema(tmp);

    mockDrizzlePush({
      sqlStatements: ['create table users (id integer);'],
      apply: vi.fn().mockRejectedValue(new Error('apply failed')),
    });

    await expect(pushSchema({ serverDistDirPath, connectionUri: 'postgres://user:pass@localhost/db' })).rejects.toThrow('apply failed');

    expect(dbMocks.client.end).toHaveBeenCalledOnce();
    expect(tmp.exists('server-dist/node_modules')).toBe(false);
  });

  it('removes the temporary symlink when importing the schema fails', async () => {
    const serverDistDirPath = tmp.mkdir('server-dist');

    await expect(pushSchema({ serverDistDirPath, connectionUri: 'postgres://user:pass@localhost/db' })).rejects.toThrow();

    expect(drizzle).not.toHaveBeenCalled();
    expect(drizzlePush).not.toHaveBeenCalled();
    expect(tmp.exists('server-dist/node_modules')).toBe(false);
  });
});
