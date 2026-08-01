import { describe, expectTypeOf, it } from 'vitest';

import { type InferDB } from '#db/drizzle.ts';
import { p } from '#db/drizzle.ts';

const _todos = p.pgTable('todos', {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  userId: p.text('user_id'),
  createdAt: p.timestamp().notNull().defaultNow(),
});

const _users = p.pgTable('users', {
  id: p.text().primaryKey(),
  email: p.text().notNull(),
});

const _NOT_A_TABLE = 'constant';

type DB = InferDB<{ todos: typeof _todos; users: typeof _users; NOT_A_TABLE: typeof _NOT_A_TABLE }>;

describe('InferDB', () => {
  it('keeps only the tables of the schema module', () => {
    expectTypeOf<keyof DB>().toEqualTypeOf<'todos' | 'users'>();
  });

  it('exposes a select and an insert model per table', () => {
    expectTypeOf<keyof DB['todos']>().toEqualTypeOf<'insert' | 'select'>();
  });

  it('types every column on the select model', () => {
    expectTypeOf<DB['todos']['select']>().toEqualTypeOf<{
      id: number;
      value: string;
      completed: boolean;
      userId: string | null;
      createdAt: Date;
    }>();
  });

  it('requires the columns without a default on the insert model', () => {
    expectTypeOf<DB['todos']['insert']['value']>().toEqualTypeOf<string>();
    expectTypeOf<DB['todos']['insert']['completed']>().toEqualTypeOf<boolean>();

    // @ts-expect-error -- `completed` has no default, so it cannot be omitted.
    const missingRequired: DB['todos']['insert'] = { value: 'buy milk' };

    void missingRequired;
  });

  it('leaves generated and defaulted columns out of a minimal insert', () => {
    const insert: DB['todos']['insert'] = { value: 'buy milk', completed: false };

    expectTypeOf(insert).toExtend<DB['todos']['insert']>();
  });

  it('marks nullable columns as optional on the insert model', () => {
    const withoutNullable: DB['todos']['insert'] = { value: 'buy milk', completed: false };
    const withNullable: DB['todos']['insert'] = { value: 'buy milk', completed: false, userId: null };

    expectTypeOf(withoutNullable).toExtend<DB['todos']['insert']>();
    expectTypeOf(withNullable).toExtend<DB['todos']['insert']>();
  });

  it('resolves a schema without tables to an empty object', () => {
    expectTypeOf<[keyof InferDB<{ NOT_A_TABLE: string }>]>().toEqualTypeOf<[never]>();
  });
});
