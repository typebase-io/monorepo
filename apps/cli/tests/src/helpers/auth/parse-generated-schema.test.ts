import { describe, expect, it } from 'vitest';

import { parseGeneratedSchema } from '#helpers/auth/parse-generated-schema.ts';

describe('parseGeneratedSchema', () => {
  it('parses tables, cleaned code, and many relations', () => {
    const schema = `import { pgTable, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
});

export const usersRelations = relations(usersTable, ({ many }) => ({
  posts: many(postsTable),
}));

export const postsTable = pgTable('posts', {
  id: text('id').primaryKey(),
  authorId: text('author_id'),
});`;

    const { cleaned, tableNames, relations } = parseGeneratedSchema(schema);

    expect(cleaned).toEqualTemplate('parse-generated-schema', 'many-relations.txt');
    expect(tableNames).toEqual(['usersTable', 'postsTable']);
    expect(relations).toEqual(
      new Map([
        [
          'usersTable',
          `{
    posts: r.many.postsTable(),
  }`,
        ],
        ['postsTable', '{}'],
      ])
    );
  });

  it('collects table names from every declaration in a variable statement', () => {
    const schema = `import { pgTable, text } from 'drizzle-orm/pg-core';

export const version = "1", usersTable = pgTable('users', {
  id: text('id').primaryKey(),
}), postsTable = pgTable('posts', {
  id: text('id').primaryKey(),
});`;

    const { cleaned, tableNames, relations } = parseGeneratedSchema(schema);

    expect(cleaned).toEqualTemplate('parse-generated-schema', 'multiple-declarations.txt');
    expect(tableNames).toEqual(['usersTable', 'postsTable']);
    expect(relations).toEqual(
      new Map([
        ['usersTable', '{}'],
        ['postsTable', '{}'],
      ])
    );
  });

  it('ignores non-table declarations', () => {
    const schema = `import { pgTable, text } from 'drizzle-orm/pg-core';

const tableName = 'users';
const generated = createGeneratedSchema();
export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
});`;

    const { cleaned, tableNames, relations } = parseGeneratedSchema(schema);

    expect(cleaned).toEqualTemplate('parse-generated-schema', 'non-table-declarations.txt');
    expect(tableNames).toEqual(['usersTable']);
    expect(relations).toEqual(new Map([['usersTable', '{}']]));
  });

  it('only prefixes imported pg-core identifiers when they are called directly', () => {
    const schema = `import { pgTable, text } from 'drizzle-orm/pg-core';
import { helper } from './helper';

const textFactory = helper.text;
export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  custom: helper.text('custom'),
});`;

    const { cleaned, tableNames, relations } = parseGeneratedSchema(schema);

    expect(cleaned).toEqualTemplate('parse-generated-schema', 'direct-pg-core-identifiers.txt');
    expect(tableNames).toEqual(['usersTable']);
    expect(relations).toEqual(new Map([['usersTable', '{}']]));
  });

  it('builds one-relation entries from generated relations calls', () => {
    const schema = `import { pgTable, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
});

export const postsTable = pgTable('posts', {
  id: text('id').primaryKey(),
  authorId: text('author_id'),
});

export const postsRelations = relations(postsTable, ({ one }) => ({
  author: one(usersTable, { fields: [postsTable.authorId], references: [usersTable.id] }),
}));`;

    const { cleaned, tableNames, relations } = parseGeneratedSchema(schema);

    expect(cleaned).toEqualTemplate('parse-generated-schema', 'one-relation.txt');
    expect(tableNames).toEqual(['usersTable', 'postsTable']);
    expect(relations).toEqual(
      new Map([
        [
          'postsTable',
          `{
    author: r.one.usersTable({
      from: r.postsTable.authorId,
      to: r.usersTable.id,
    }),
  }`,
        ],
        ['usersTable', '{}'],
      ])
    );
  });
});
