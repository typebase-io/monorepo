import fs from 'node:fs';
import { createRequire } from 'node:module';

import { drizzle } from 'drizzle-orm/node-postgres';
import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { markMigrationApplied } from '#helpers/db/mark-migration-applied.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const dbMocks = vi.hoisted(() => ({
  client: { end: vi.fn(), on: vi.fn() },
  execute: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({ $client: dbMocks.client, execute: dbMocks.execute })),
}));

/** The literal SQL of a drizzle query, dropping the interpolated identifiers and parameters. */
const textOf = (chunk: unknown): string => {
  if (typeof chunk === 'string') {
    return chunk;
  }

  const { value } = (chunk ?? {}) as { value?: unknown };

  return Array.isArray(value) ? value.map(textOf).join('') : '';
};

const statements = () =>
  vi
    .mocked(dbMocks.execute)
    .mock.calls.map(([query]) => ((query as { queryChunks?: unknown[] }).queryChunks ?? []).map(textOf).join(''))
    .join('\n');

describe('markMigrationApplied', () => {
  let tmp: TempDir;
  let migrationsDirPath: string;

  const mark = (name = '20260101000000_baseline') => markMigrationApplied({ migrationsDirPath, connectionUri: 'postgres://neon/db', name });

  beforeEach(() => {
    tmp = createTempDir();
    migrationsDirPath = tmp.mkdir('migrations');

    tmp.write('migrations/20260101000000_baseline/migration.sql', 'CREATE TABLE "todos";');

    vi.clearAllMocks();

    dbMocks.client.end.mockResolvedValue(undefined);
    dbMocks.execute.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('records the migration and closes the connection', async () => {
    expect(await mark()).toEqual({ marked: true });

    expect(drizzle).toHaveBeenCalledWith('postgres://neon/db');
    expect(dbMocks.client.end).toHaveBeenCalledOnce();
  });

  it('creates the bookkeeping schema and table before writing to them', async () => {
    await mark();

    const issued = statements();

    expect(issued).toContain('CREATE SCHEMA IF NOT EXISTS');
    expect(issued).toContain('CREATE TABLE IF NOT EXISTS');
    expect(issued.indexOf('CREATE TABLE IF NOT EXISTS')).toBeLessThan(issued.indexOf('INSERT INTO'));
  });

  it('does not record the same migration twice on one target', async () => {
    dbMocks.execute.mockResolvedValue({ rows: [{ name: '20260101000000_baseline' }] });

    expect(await mark()).toEqual({ marked: false });
    expect(statements()).not.toContain('INSERT INTO');
  });

  it('does nothing when the migration has no sql for the migrator to skip', async () => {
    fs.rmSync(`${migrationsDirPath}/20260101000000_baseline/migration.sql`);

    expect(await mark()).toEqual({ marked: false });
    expect(drizzle).not.toHaveBeenCalled();
  });

  it('does nothing when the named migration is not there', async () => {
    expect(await mark('20260101000000_missing')).toEqual({ marked: false });
    expect(drizzle).not.toHaveBeenCalled();
  });

  it('reports progress while it works, and clears the line for the caller to report the outcome', async () => {
    await mark();

    expect(vi.mocked(ora).mock.calls.flat()).toContain('Marking the baseline as applied...');
    expect(vi.mocked(ora()).stop.mock.calls).not.toHaveLength(0);
    expect(vi.mocked(ora()).succeed.mock.calls).toHaveLength(0);
  });

  it('starts no spinner when there is nothing to mark', async () => {
    expect(await mark('20260101000000_missing')).toEqual({ marked: false });

    expect(vi.mocked(ora).mock.calls.flat()).not.toContain('Marking the baseline as applied...');
  });

  it('stops the spinner when a statement fails', async () => {
    dbMocks.execute.mockRejectedValue(new Error('permission denied for schema drizzle'));

    await expect(mark()).rejects.toThrow('permission denied');

    expect(vi.mocked(ora()).stop.mock.calls).not.toHaveLength(0);
  });

  it('swallows connection errors so a dropped socket cannot crash the process', async () => {
    await mark();

    expect(dbMocks.client.on).toHaveBeenCalledWith('error', expect.any(Function));

    const errorHandler = dbMocks.client.on.mock.calls[0]?.[1] as (() => void) | undefined;

    expect(errorHandler?.()).toBeUndefined();
  });

  it('closes the connection when a statement fails', async () => {
    dbMocks.execute.mockRejectedValue(new Error('permission denied for schema drizzle'));

    await expect(mark()).rejects.toThrow('permission denied for schema drizzle');

    expect(dbMocks.client.end).toHaveBeenCalledOnce();
  });

  it('writes the table shape drizzle itself creates', () => {
    const migratorPath = createRequire(import.meta.url).resolve('drizzle-orm/pg-core/async/session');
    const migratorSource = fs.readFileSync(migratorPath, 'utf8');

    for (const column of [
      'id SERIAL PRIMARY KEY',
      'hash text NOT NULL',
      'created_at bigint',
      'name text',
      'applied_at timestamp with time zone DEFAULT now()',
    ]) {
      expect(migratorSource).toContain(column);
    }

    expect(migratorSource).toContain('"hash", "created_at", "name"');
    expect(migratorSource).toContain('__drizzle_migrations');
    expect(migratorSource).toContain('"drizzle"');
  });
});
