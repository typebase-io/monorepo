import * as drizzleCore from 'drizzle-orm';
import * as drizzlePgCore from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { p, q } from '#db/drizzle.ts';

describe('p', () => {
  it('re-exports drizzle`s pg-core namespace', () => {
    expect(p).toBe(drizzlePgCore);
  });

  it('exposes the column and table builders the templates rely on', () => {
    expect(typeof p.pgTable).toBe('function');
    expect(typeof p.integer).toBe('function');
    expect(typeof p.text).toBe('function');
    expect(typeof p.varchar).toBe('function');
    expect(typeof p.boolean).toBe('function');
    expect(typeof p.timestamp).toBe('function');
  });

  it('builds a usable table', () => {
    const todos = p.pgTable('todos', {
      id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
      value: p.varchar({ length: 255 }).notNull(),
    });

    expect(drizzleCore.getTableName(todos)).toBe('todos');
    expect(Object.keys(drizzleCore.getColumns(todos))).toEqual(['id', 'value']);
  });
});

describe('q', () => {
  it('re-exports drizzle`s core namespace', () => {
    expect(q).toBe(drizzleCore);
  });

  it('exposes the query helpers the templates rely on', () => {
    expect(typeof q.defineRelations).toBe('function');
    expect(typeof q.eq).toBe('function');
    expect(typeof q.and).toBe('function');
    expect(typeof q.sql).toBe('function');
  });

  it('builds relations from a schema', () => {
    const users = p.pgTable('users', { id: p.text().primaryKey() });
    const todos = p.pgTable('todos', { id: p.integer().primaryKey(), userId: p.text().notNull() });

    const relations = q.defineRelations({ users, todos }, (r) => ({
      todos: {
        user: r.one.users({ from: r.todos.userId, to: r.users.id }),
      },
    }));

    expect(Object.keys(relations)).toEqual(['users', 'todos']);
    expect(Object.keys(relations.todos.relations)).toEqual(['user']);
  });
});
