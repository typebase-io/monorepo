import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addExampleTodosRelation } from '#helpers/init/add-example-todos-relation.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('addExampleTodosRelation', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('appends the todos relation to the users entry', () => {
    tmp.write(
      'relations.ts',
      `import { q } from "typebase-io/db";

import * as schema from "./schema.ts";

export const relations = q.defineRelations(schema, (r) => ({
  todos: {
    user: r.one.users({
      from: r.todos.userId,
      to: r.users.id,
    }),
  },
  users: {
    sessions: r.many.sessions({
      from: r.users.id,
      to: r.sessions.userId,
    }),
  },
}));
`
    );

    addExampleTodosRelation({ relationsFilePath: path.join(tmp.path, 'relations.ts') });

    expect(tmp.read('relations.ts')).toBe(`import { q } from "typebase-io/db";

import * as schema from "./schema.ts";

export const relations = q.defineRelations(schema, (r) => ({
  todos: {
    user: r.one.users({
      from: r.todos.userId,
      to: r.users.id,
    }),
  },
  users: {
    sessions: r.many.sessions({
      from: r.users.id,
      to: r.sessions.userId,
    }),
    todos: r.many.todos({
      from: r.users.id,
      to: r.todos.userId,
    }),
  },
}));
`);
  });

  it('throws when there is no users entry', () => {
    tmp.write(
      'relations.ts',
      `import { q } from "typebase-io/db";

import * as schema from "./schema.ts";

export const relations = q.defineRelations(schema, (r) => ({
  todos: {},
}));
`
    );

    expect(() => {
      addExampleTodosRelation({ relationsFilePath: path.join(tmp.path, 'relations.ts') });
    }).toThrow('no `users` entry found');
  });
});
