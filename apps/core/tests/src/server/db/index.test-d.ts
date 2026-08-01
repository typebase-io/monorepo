import { describe, expectTypeOf, it } from 'vitest';

import { p, q } from '#db/drizzle.ts';

import { type DB } from '#server/actions/types.ts';
import { type GetDBBuilder } from '#server/db/index.ts';

const todos = p.pgTable('todos', { id: p.integer().primaryKey(), userId: p.text().notNull() });
const users = p.pgTable('users', { id: p.text().primaryKey() });

const _relations = q.defineRelations({ todos, users }, (r) => ({
  todos: { user: r.one.users({ from: r.todos.userId, to: r.users.id }) },
}));

type Relations = typeof _relations;

describe('GetDBBuilder', () => {
  it('is a function returning the project database', () => {
    expectTypeOf<GetDBBuilder<Relations>>().toEqualTypeOf<() => DB<Relations>>();
  });

  it('carries the project relations into the returned database', () => {
    expectTypeOf<keyof ReturnType<GetDBBuilder<Relations>>['query']>().toEqualTypeOf<'todos' | 'users'>();
  });
});
