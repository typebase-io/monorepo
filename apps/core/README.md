# @typebase-io/core

> A type-safe backend-in-a-repo. Database, actions, and auth as TypeScript files — one command ships a fully typed server your frontend calls like local functions.

**[Documentation](https://typebase.io/docs) · [Getting started](https://typebase.io/docs/getting-started) · [Examples](https://github.com/typebase-io/monorepo/tree/main/apps/examples)**

## What is Typebase?

Typebase lets you write your backend as a `typebase/` folder inside your existing app. You define:

- **Tables** in `db/schema.ts` (Drizzle ORM)
- **Actions** in `actions/` — typed server functions with input and output validation
- **Auth** in `auth.ts` (better-auth)

You run one command and it becomes a deployed HTTP server on Vercel, Cloudflare Workers, or Deno Deploy — with a fully typed client your frontend calls directly. No REST routes, no OpenAPI file, no code generation on the frontend.

```ts
// typebase/actions/queries/todos.ts
import { z } from 'zod';
import { action } from '../../_generated/server';

export const getMany = action.output(z.array(z.object({ id: z.number(), value: z.string() }))).handler(async ({ db }) => {
  return db.query.todos.findMany();
});
```

```tsx
// src/app/page.tsx
import { client } from '@/lib/typebase/client';

export default async function Page() {
  const todos = await client.queries.todos.getMany();
  //    ^? { id: number; value: string }[]

  return todos.map((t) => <li key={t.id}>{t.value}</li>);
}
```

Types flow from your columns, through your handlers, into your JSX. Change the schema and TypeScript tells you what to fix — everywhere.

## Install

```bash
npm install typebase-io
npm install -D typebase-io-cli
```

Then scaffold your backend:

```bash
npx typebase-io-cli init
```

See the full [Getting started guide](https://typebase.io/docs/getting-started).

## What's in the box

This package is the runtime library your app imports. Its sibling [`typebase-io-cli`](https://www.npmjs.com/package/typebase-io-cli) glues it all together.

| Entry point                 | What's inside                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `typebase-io/server`        | The `action` builder, `defineAuth`, middleware, and server runtime                              |
| `typebase-io/db`            | Drizzle ORM exports (`p` and `q`) for defining schema and relations                             |
| `typebase-io/client`        | `createRouterClient` and `createTanstackQueryClient` for calling your backend from any frontend |
| `typebase-io/client/auth/*` | Framework auth helpers for Next.js, SvelteKit, Nuxt, Expo, React, and Vue                       |

## Works with every framework you already use

First-class integration guides for:

- **[Next.js](https://typebase.io/docs/integrations/nextjs)** — Server Components, Server Actions, React Query
- **[SvelteKit](https://typebase.io/docs/integrations/sveltekit)** — load functions, `hooks.server.ts`, Svelte Query
- **[Nuxt](https://typebase.io/docs/integrations/nuxt)** — Nuxt plugins, server middleware, Vue Query
- **[Expo](https://typebase.io/docs/integrations/expo)** — React Native with SecureStore-backed auth

## Built on libraries you already trust

Typebase isn't a new framework — it's a thin layer over three well-known projects:

- **[Drizzle ORM](https://orm.drizzle.team)** for the schema and query layer
- **[oRPC](https://orpc.dev)** for the typed RPC transport
- **[better-auth](https://www.better-auth.com)** for sessions, email/password, OAuth, and more

Nothing is magic. The generated server is readable TypeScript. You can eject, fork, or uninstall the CLI — the deployed server keeps running.

## License

[MIT](https://github.com/typebase-io/monorepo/blob/main/LICENSE)
