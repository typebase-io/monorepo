import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasEventsTable } from '#helpers/shared/has-events-table.ts';

import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('hasEventsTable', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  const check = (source: string) => {
    tmp.write('schema.ts', removeExtraSpaces(source));

    return hasEventsTable(path.join(tmp.path, 'schema.ts'));
  };

  it('finds it re-exported from the package it comes from', () => {
    expect(check('export { events } from "typebase-io/db";')).toBe(true);
  });

  it('finds it re-exported after being imported', () => {
    expect(
      check(`
        import { events, p } from "typebase-io/db";

        export { events };

        export const todos = p.pgTable("todos", {});
      `)
    ).toBe(true);
  });

  it('finds it under an alias', () => {
    expect(check('export { eventsTable as events } from "./tables.ts";')).toBe(true);
  });

  it('finds a table declared in the file itself', () => {
    expect(check('export const events = pgTable("events", {});')).toBe(true);
  });

  it('gives a bare `export *` the benefit of the doubt', () => {
    expect(check('export * from "./tables.ts";')).toBe(true);
  });

  it('is false when the schema has other tables but no events', () => {
    expect(
      check(`
        import { p } from "typebase-io/db";

        export const todos = p.pgTable("todos", {});
      `)
    ).toBe(false);
  });

  it('is false when a local events table is never exported', () => {
    expect(check('const events = pgTable("events", {});')).toBe(false);
  });

  it('is false when there is no schema file at all', () => {
    expect(hasEventsTable(path.join(tmp.path, 'missing.ts'))).toBe(false);
  });
});
