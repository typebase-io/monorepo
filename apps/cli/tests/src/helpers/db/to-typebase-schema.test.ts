import { describe, expect, it } from 'vitest';

import { toTypebaseSchema } from '#helpers/db/to-typebase-schema.ts';

import { readPulledSource } from '#tests/helpers/read-pulled-source.ts';

describe('toTypebaseSchema', () => {
  it('rewrites what drizzle-kit pulled into a Typebase schema file', () => {
    const { source } = toTypebaseSchema(readPulledSource('schema.ts.txt'));

    expect(source).toEqualTemplate('db-pull', 'schema.ts.txt');
  });

  it('returns every pulled table, and only tables', () => {
    const { tableNames } = toTypebaseSchema(readPulledSource('schema.ts.txt'));

    expect(tableNames).toEqual(['logs', 'todoLabels', 'todos', 'users']);
  });

  it('returns no tables for a database that has none', () => {
    const { tableNames } = toTypebaseSchema(readPulledSource('empty-schema.ts.txt'));

    expect(tableNames).toEqual([]);
  });
});
