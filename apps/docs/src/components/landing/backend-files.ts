import { steps } from '#components/landing/walkthrough-steps.ts';

export interface BackendFile {
  id: string;
  path: string;
  chip: string;
  description: string;
  code: string;
}

export interface TreeRow {
  depth: number;
  label: string;
  id?: string;
}

export const backendFiles: BackendFile[] = [
  {
    id: 'mutations',
    path: 'typebase/actions/mutations/todos.ts',
    chip: 'write',
    description: 'Validate input, insert a todo, and publish a typed event.',
    code: `import { z } from 'zod';
import { ServerError } from 'typebase-io/server';
import { action } from '../../_generated/server';
import { todos } from '../../db/schema';

export const create = action
  .input(z.object({ value: z.string().min(1) }))
  .handler(async ({ db, input, publisher }) => {
    const [todo] = await db.insert(todos).values(input).returning();
    if (!todo) throw new ServerError('INTERNAL_SERVER_ERROR');

    await publisher.publish('todo.created', todo);
    return todo;
  });`,
  },
  {
    id: 'queries',
    path: 'typebase/actions/queries/todos.ts',
    chip: 'read',
    description: 'Read data through a server function. Its return type reaches your frontend.',
    code: steps[1].code,
  },
  {
    id: 'relations',
    path: 'typebase/db/relations.ts',
    chip: 'queries',
    description: 'Register the tables available to your typed queries.',
    code: `import { q } from 'typebase-io/db';
import * as schema from './schema';

export const relations = q.defineRelations(schema, () => ({
  todos: {},
}));`,
  },
  {
    id: 'schema',
    path: 'typebase/db/schema.ts',
    chip: 'tables',
    description: 'Your Postgres tables, defined with Drizzle.',
    code: steps[0].code,
  },
  {
    id: 'auth',
    path: 'typebase/auth.ts',
    chip: 'auth',
    description: 'Configure better-auth. Use an authenticated action for private data.',
    code: `import { defineAuth } from 'typebase-io/server';

export const auth = defineAuth({
  trustedOrigins: ['http://localhost:3000'],
  emailAndPassword: { enabled: true },
});`,
  },
  {
    id: 'env',
    path: 'typebase/env.ts',
    chip: 'config',
    description: 'Validate the environment variables your actions need.',
    code: `import { defineEnv } from 'typebase-io/server';
import { z } from 'zod';

export const env = defineEnv({
  EXAMPLE_API_KEY: z.string().min(1),
});`,
  },
  {
    id: 'publisher',
    path: 'typebase/publisher.ts',
    chip: 'realtime',
    description: 'Declare typed events to publish from mutations and consume in streams.',
    code: `import { definePublisher } from 'typebase-io/server';
import { z } from 'zod';

export const publisher = definePublisher({
  provider: 'db',
  events: {
    'todo.created': z.object({
      id: z.number(),
      value: z.string(),
      completed: z.boolean(),
    }),
  },
});`,
  },
];

export const treeRows: TreeRow[] = [
  { depth: 0, label: 'typebase/' },
  { depth: 1, label: 'actions/' },
  { depth: 2, label: 'mutations/' },
  { depth: 3, label: 'todos.ts', id: 'mutations' },
  { depth: 2, label: 'queries/' },
  { depth: 3, label: 'todos.ts', id: 'queries' },
  { depth: 1, label: 'db/' },
  { depth: 2, label: 'relations.ts', id: 'relations' },
  { depth: 2, label: 'schema.ts', id: 'schema' },
  { depth: 1, label: 'auth.ts', id: 'auth' },
  { depth: 1, label: 'env.ts', id: 'env' },
  { depth: 1, label: 'publisher.ts', id: 'publisher' },
];
