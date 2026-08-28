import path from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/pg-core/async/session';
import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyMigrations } from '#helpers/db/apply-migrations.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const dbMocks = vi.hoisted(() => ({
  client: { end: vi.fn(), on: vi.fn() },
  execute: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({ $client: dbMocks.client, execute: dbMocks.execute })),
}));

vi.mock('drizzle-orm/pg-core/async/session', () => ({ migrate: vi.fn() }));

const appliedRows = (...names: (string | null)[]) => Promise.resolve({ rows: names.map((name) => ({ name })) });

describe('applyMigrations', () => {
  let tmp: TempDir;
  let migrationsDirPath: string;

  const apply = () => applyMigrations({ migrationsDirPath, connectionUri: 'postgres://local/db' });

  beforeEach(() => {
    tmp = createTempDir();
    migrationsDirPath = tmp.mkdir('migrations');

    vi.clearAllMocks();

    dbMocks.client.end.mockResolvedValue(undefined);
    dbMocks.execute.mockReturnValue(appliedRows());
    vi.mocked(migrate).mockResolvedValue(undefined);
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('never opens a connection when the migrations directory is empty', async () => {
    expect(await apply()).toEqual({ applied: [] });

    expect(drizzle).not.toHaveBeenCalled();
    expect(migrate).not.toHaveBeenCalled();
  });

  it('never opens a connection when the migrations directory is missing', async () => {
    migrationsDirPath = path.join(tmp.path, 'nope');

    expect(await apply()).toEqual({ applied: [] });

    expect(drizzle).not.toHaveBeenCalled();
  });

  it('applies the migrations it read and reports them', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');
    tmp.write('migrations/20260201000000_second/migration.sql', 'SELECT 2;');

    expect(await apply()).toEqual({ applied: ['20260101000000_first', '20260201000000_second'] });

    expect(drizzle).toHaveBeenCalledWith('postgres://local/db');

    expect(vi.mocked(migrate).mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ name: '20260101000000_first', sql: ['SELECT 1;'] }),
      expect.objectContaining({ name: '20260201000000_second', sql: ['SELECT 2;'] }),
    ]);
  });

  it('reports nothing applied when the target already recorded every migration', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');

    dbMocks.execute.mockReturnValue(appliedRows('20260101000000_first'));

    expect(await apply()).toEqual({ applied: [] });
  });

  it('reports only the migrations the target had not recorded', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');
    tmp.write('migrations/20260201000000_second/migration.sql', 'SELECT 2;');

    dbMocks.execute.mockReturnValue(appliedRows('20260101000000_first'));

    expect(await apply()).toEqual({ applied: ['20260201000000_second'] });
  });

  it('treats a missing bookkeeping table as nothing applied yet', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');

    dbMocks.execute.mockReturnValue(Promise.reject(new Error('relation "drizzle.__drizzle_migrations" does not exist')));

    expect(await apply()).toEqual({ applied: ['20260101000000_first'] });
    expect(migrate).toHaveBeenCalledOnce();
  });

  it('ignores bookkeeping rows that carry no name', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');

    dbMocks.execute.mockReturnValue(appliedRows(null));

    expect(await apply()).toEqual({ applied: ['20260101000000_first'] });
  });

  it('points the migrator at the drizzle bookkeeping schema and table', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');

    await apply();

    expect(vi.mocked(migrate).mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ migrationsSchema: 'drizzle', migrationsTable: '__drizzle_migrations' })
    );
  });

  it('surfaces the database error and still closes the connection', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');

    vi.mocked(migrate).mockRejectedValue(new Error('syntax error at or near "CREAT"'));

    await expect(apply()).rejects.toThrow('syntax error at or near "CREAT"');

    expect(dbMocks.client.end).toHaveBeenCalledOnce();
  });

  it('reports progress while it works, and clears the line for the caller to report the outcome', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');

    await apply();

    expect(vi.mocked(ora).mock.calls.flat()).toContain('Applying migrations...');
    expect(vi.mocked(ora()).stop.mock.calls).not.toHaveLength(0);
    expect(vi.mocked(ora()).succeed.mock.calls).toHaveLength(0);
  });

  it('starts no spinner when there are no migrations to apply', async () => {
    expect(await apply()).toEqual({ applied: [] });

    expect(vi.mocked(ora).mock.calls.flat()).not.toContain('Applying migrations...');
  });

  it('stops the spinner when a migration fails', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');

    vi.mocked(migrate).mockRejectedValue(new Error('syntax error at or near "CREAT"'));

    await expect(apply()).rejects.toThrow('syntax error');

    expect(vi.mocked(ora()).stop.mock.calls).not.toHaveLength(0);
  });

  it('swallows connection errors so a dropped socket cannot crash the process', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');

    await apply();

    expect(dbMocks.client.on).toHaveBeenCalledWith('error', expect.any(Function));

    const errorHandler = dbMocks.client.on.mock.calls[0]?.[1] as (() => void) | undefined;

    expect(errorHandler?.()).toBeUndefined();
  });

  it('closes the connection after a successful apply', async () => {
    tmp.write('migrations/20260101000000_first/migration.sql', 'SELECT 1;');

    await apply();

    expect(dbMocks.client.end).toHaveBeenCalledOnce();
  });
});
