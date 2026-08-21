export const exampleRelationsTemplate = (withAuth: boolean, withPublisher: boolean) => `import { q } from "typebase-io/db";

import * as schema from "./schema.ts";

export const relations = q.defineRelations(schema, (r) => ({
  todos: {${
    withAuth
      ? `
    user: r.one.users({
      from: r.todos.userId,
      to: r.users.id,
    }),
  `
      : ''
  }},${withPublisher ? '\n  events: {},' : ''}
}));`;
