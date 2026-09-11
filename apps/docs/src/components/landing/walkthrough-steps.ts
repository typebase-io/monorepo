export const steps = [
  {
    name: 'Database',
    file: 'typebase/db/schema.ts',
    heading: 'Give your data a home.',
    description: 'Define your Postgres tables in TypeScript. Typebase gives your server functions a typed database client.',
    guide: '/docs/database',
    guideLabel: 'Explore the database guide',
    code: `import { p } from 'typebase-io/db';

export const todos = p.pgTable('todos', {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.text().notNull(),
  completed: p.boolean().notNull().default(false),
});`,
    note: 'Register this table in db/relations.ts to query it in your actions.',
  },
  {
    name: 'Server function',
    file: 'typebase/actions/queries/todos.ts',
    heading: 'Write the function. That’s your API.',
    description: 'An action is a function that runs on your server. Typebase handles the endpoint and carries its types to your frontend.',
    guide: '/docs/actions',
    guideLabel: 'Explore the actions guide',
    code: `import { action } from '../../_generated/server';

export const getMany = action
  .handler(async ({ db }) => {
    return db.query.todos.findMany();
  });`,
    note: 'Your database credentials and server logic stay on the server.',
  },
  {
    name: 'Frontend',
    file: 'src/app/page.tsx',
    heading: 'Call it like a local function.',
    description:
      'Your frontend gets autocomplete and type checking, all the way back to your database. The call travels over HTTP; Typebase handles that part.',
    guide: '/docs/client',
    guideLabel: 'Explore the client guide',
    code: `import { client } from '@/lib/typebase/client';

export default async function Page() {
  const todos = await client.queries.todos.getMany();
  // ^? { id: number; value: string; completed: boolean }[]

  return todos.map((todo) => (
    <div key={todo.id}>{todo.value}</div>
  ));
}`,
    note: 'The client guide covers creating and connecting your typed client.',
  },
] as const;
