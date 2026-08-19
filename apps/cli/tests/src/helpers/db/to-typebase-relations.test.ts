import { describe, expect, it } from 'vitest';

import { toTypebaseRelations } from '#helpers/db/to-typebase-relations.ts';

import { readPulledSource } from '#tests/helpers/read-pulled-source.ts';
import { removeExtraSpaces } from '#tests/helpers/remove-extra-spaces.ts';

const tableNames = ['logs', 'todoLabels', 'todos', 'users'];

describe('toTypebaseRelations', () => {
  it('rewrites what drizzle-kit pulled into a Typebase relations file, registering the tables it left out', () => {
    const relations = toTypebaseRelations({ source: readPulledSource('relations.ts.txt'), tableNames });

    expect(relations).toEqualTemplate('db-pull', 'relations.ts.txt');
  });

  it('registers every table when the database has no foreign keys at all', () => {
    const relations = toTypebaseRelations({ source: readPulledSource('empty-relations.ts.txt'), tableNames: ['logs'] });

    expect(relations).toEqualTemplate('db-pull', 'relations', 'no-foreign-keys.ts.txt');
  });

  it('registers missing tables around entries it cannot read a name from', () => {
    const source = removeExtraSpaces(`
      import { defineRelations } from "drizzle-orm";
      import * as schema from "./schema";

      export const relations = defineRelations(schema, (r) => ({
        ...base,
      }))
    `);

    expect(toTypebaseRelations({ source, tableNames: ['logs'] })).toEqualTemplate('db-pull', 'relations', 'spread-entry.ts.txt');
  });

  it('throws when the pulled file is not a defineRelations call', () => {
    expect(() => toTypebaseRelations({ source: 'export const relations = {};\n', tableNames })).toThrow(
      'Could not read the relations generated for that database'
    );
  });
});
