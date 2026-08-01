import { type EmptyRelations } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { describe, expectTypeOf, it } from 'vitest';

import { p, q } from '#db/drizzle.ts';

import { type DB } from '#server/actions/types.ts';

const todos = p.pgTable('todos', { id: p.integer().primaryKey(), value: p.text().notNull(), userId: p.text().notNull() });
const users = p.pgTable('users', { id: p.text().primaryKey() });

const _relations = q.defineRelations({ todos, users }, (r) => ({
  todos: { user: r.one.users({ from: r.todos.userId, to: r.users.id }) },
}));

type Relations = typeof _relations;

describe('DB', () => {
  it('is a node-postgres drizzle database', () => {
    expectTypeOf<DB<Relations>>().toExtend<NodePgDatabase<Record<string, never>, Relations>>();
  });

  it('exposes the pg pool as `$client`, so `db.$client.end()` is typed', () => {
    expectTypeOf<DB<Relations>['$client']>().toEqualTypeOf<Pool>();
  });

  it('exposes the relational query builder for every table', () => {
    expectTypeOf<keyof DB<Relations>['query']>().toEqualTypeOf<'todos' | 'users'>();
  });

  it('types the rows returned by the relational query builder', () => {
    type Todo = Awaited<ReturnType<DB<Relations>['query']['todos']['findFirst']>>;

    expectTypeOf<Todo>().toEqualTypeOf<{ id: number; value: string; userId: string } | undefined>();
  });

  it('defaults to an empty set of relations', () => {
    expectTypeOf<DB>().toEqualTypeOf<DB<EmptyRelations>>();
    expectTypeOf<keyof DB['query']>().toEqualTypeOf<never>();
  });
});
