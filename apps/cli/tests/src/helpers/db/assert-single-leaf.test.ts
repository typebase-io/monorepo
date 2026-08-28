import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertSingleLeaf } from '#helpers/db/assert-single-leaf.ts';
import { readMigrations } from '#helpers/db/read-migrations.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const ORIGIN = '00000000-0000-0000-0000-000000000000';

describe('assertSingleLeaf', () => {
  let tmp: TempDir;
  let migrationsDirPath: string;

  const record = (name: string, id: string, prevId: string) => {
    tmp.write(`migrations/${name}/snapshot.json`, JSON.stringify({ version: '8', dialect: 'postgres', id, prevIds: [prevId], ddl: [], renames: [] }));
  };

  const assert = async () => {
    const migrations = await readMigrations(migrationsDirPath);

    return () => {
      assertSingleLeaf(migrations);
    };
  };

  beforeEach(() => {
    tmp = createTempDir();
    migrationsDirPath = tmp.mkdir('migrations');
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('accepts a history with no migrations at all', async () => {
    expect(await assert()).not.toThrow();
  });

  it('accepts a history with a single migration', async () => {
    record('20260101000000_first', 'one', ORIGIN);

    expect(await assert()).not.toThrow();
  });

  it('accepts a linear history', async () => {
    record('20260101000000_first', 'one', ORIGIN);
    record('20260201000000_second', 'two', 'one');
    record('20260301000000_third', 'three', 'two');

    expect(await assert()).not.toThrow();
  });

  it('accepts a custom migration that copied its predecessor snapshot verbatim', async () => {
    record('20260101000000_first', 'one', ORIGIN);
    record('20260201000000_backfill', 'one', ORIGIN);

    expect(await assert()).not.toThrow();
  });

  it('refuses when two migrations continue from the same parent', async () => {
    record('20260101000000_first', 'one', ORIGIN);
    record('20260201000000_add_priority', 'two', 'one');
    record('20260201000000_add_status', 'three', 'one');

    expect(await assert()).toThrow('Your migration history has forked');
  });

  it('names the competing migrations', async () => {
    record('20260101000000_first', 'one', ORIGIN);
    record('20260201000000_add_priority', 'two', 'one');
    record('20260201000000_add_status', 'three', 'one');

    const thrown = await assert();

    expect(thrown).toThrow('20260201000000_add_priority');
    expect(thrown).toThrow('20260201000000_add_status');
  });

  it('explains how a fork usually happens and how to resolve it', async () => {
    record('20260101000000_first', 'one', ORIGIN);
    record('20260201000000_add_priority', 'two', 'one');
    record('20260201000000_add_status', 'three', 'one');

    const thrown = await assert();

    expect(thrown).toThrow('two branches each recorded a migration and were then merged');
    expect(thrown).toThrow('--ignore-conflicts');
  });

  it('counts every leaf when a history forked three ways', async () => {
    record('20260101000000_first', 'one', ORIGIN);
    record('20260201000000_a', 'two', 'one');
    record('20260201000000_b', 'three', 'one');
    record('20260201000000_c', 'four', 'one');

    expect(await assert()).toThrow('These 3 migrations each continue from the same point');
  });

  it('refuses when two roots were recorded independently', async () => {
    record('20260101000000_first', 'one', ORIGIN);
    record('20260201000000_other', 'two', ORIGIN);

    expect(await assert()).toThrow('Your migration history has forked');
  });
});
