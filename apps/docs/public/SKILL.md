---
name: typebase
description: Build, deploy, and consume a Typebase backend using typed actions and streams, middleware, Drizzle PostgreSQL schema and relations, better-auth, validated environment variables, and typed publishers. Use when a project contains typebase-io, typebase-io-cli, typebase.json, or a Typebase project directory, or when the user mentions Typebase, the action builder, defineAuth, defineEnv, definePublisher, codegen, db push/pull/migrate, migrations, deploy, logs, or generate-server.
---

# Typebase

Typebase turns a directory of TypeScript files into a deployed, type-safe HTTP server. It uses oRPC for RPC, Drizzle for PostgreSQL, better-auth for authentication, Neon for managed databases, and Vercel, Cloudflare Workers, or Deno Deploy for hosting.

## Start by resolving the project

Before reading or writing backend files:

1. Find the project root and inspect `package.json`, `typebase.json`, and likely backend directories. First determine whether this is an existing Typebase setup or a project where Typebase still needs to be installed. Do not run `npx typebase-io-cli ...` as a discovery probe: when the CLI is absent, `npx` may fetch and execute a package that the project does not declare.
2. If Typebase is not installed and the user asked to add or set it up, add `typebase-io` as a dependency and `typebase-io-cli` as a dev dependency. Keep their versions aligned and upgrade them together. A local package script such as `"typebase": "typebase-io-cli"` pins every teammate to the installed CLI. For a CommonJS project (`"type": "commonjs"` or no `type`), use the equivalent `typebase-io-cli-cjs` binary. If the request is only inspection or advice, do not install anything implicitly.
3. If Typebase files or `typebase.json` exist but the packages are missing, treat the setup as incomplete. Inspect the files directly and restore/install dependencies only when the task authorizes it; do not assume CLI commands are available.
4. Once the local CLI is available, resolve the effective `projectPath`. Prefer its read-only `config` command; it returns `{ projectRoot, configPath, schema }`, and `schema.properties.projectPath['x-current-value']` is the path in effect. The default is `src/typebase` when `src/` exists, otherwise `typebase`.
5. Treat that directory as `<tb>` throughout this skill. Never assume the backend is literally at root-level `typebase/` and never create a second backend tree.
6. Inspect existing conventions before editing. Preserve the user's package manager, validation library, action organization, auth configuration, and formatting.

For a new setup, initialize only after installation with `npx typebase-io-cli init`. Before running it, inspect every scaffold target: a partial backend without `<tb>/tsconfig.json` may have same-named files overwritten even without `-f`, so obtain explicit overwrite authorization if any target already exists. Add `--with-auth`, `--with-db-publisher`, or both when requested. `--skip-example` conflicts with either feature flag; it omits example actions, schema content, and `env.ts`, but keeps the base `db/schema.ts` and `db/relations.ts` files.

## Project model and hard rules

```text
<tb>/
├── _generated/          # generated; never edit
├── actions/             # folder/export structure becomes the client API
├── db/
│   ├── schema.ts        # Drizzle schema, source of truth
│   └── relations.ts     # every exported table is registered
├── auth.ts              # optional better-auth config
├── env.ts               # optional env declarations and parsing
├── publisher.ts         # optional typed events
└── tsconfig.json
```

- `<tb>/` is server-only. Frontend code may import generated types, never backend runtime values. Backend code must not import from the frontend.
- Files inside `<tb>/` may import each other. Helpers may live beside actions.
- Every action file anywhere under `actions/` maps to the router. For example, `actions/queries/todos.ts` exporting `getOne` becomes `client.queries.todos.getOne`. `queries` and `mutations` are conventions only. Only full procedures are exported to the client.
- When `db/schema.ts` exists, `db/relations.ts` is required. Register every exported table, using `{}` for a table without relations.
- `auth.ts` requires `db/schema.ts`; Typebase cannot build/codegen/deploy auth without a database schema.
- `publisher.ts` with `provider: 'db'` requires `db/schema.ts`, the canonical exported `events` table, and `events: {}` in relations.
- Preserve end-to-end types. Do not use `any`, unsafe `as` casts, `@ts-ignore`, or `@ts-expect-error` to hide mismatches. Fix schema nullability, relations, action output, or stale generated types instead. `as const` is fine.

## Actions

Import `action` from `<tb>/_generated/server.ts`. Use `.handler()` for one result or `.stream()` for multiple SSE events. `.input()` and `.output()` are optional and accept any Standard Schema implementation such as Zod, Valibot, or ArkType.

```ts
import { ServerError } from 'typebase-io/server';
import { z } from 'zod';

import { action } from '../../_generated/server.ts';

export const getOne = action
  .input(z.object({ id: z.number() }))
  .output(z.object({ id: z.number(), value: z.string() }))
  .handler(async ({ db, input }) => {
    const todo = await db.query.todos.findFirst({ where: { id: input.id } });

    if (!todo) throw new ServerError('NOT_FOUND');

    return { id: todo.id, value: todo.value };
  });
```

- `.input()` validates and parses client input. `input` has the schema's output type.
- `.output()` validates the result at runtime. If omitted, TypeScript infers the result or event type, but there is no runtime output validation.
- Throw `new ServerError(code, { message? })` for structured failures.

Available `ServerError` codes are: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `METHOD_NOT_SUPPORTED` (405), `NOT_ACCEPTABLE` (406), `TIMEOUT` (408), `CONFLICT` (409), `PRECONDITION_FAILED` (412), `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `UNPROCESSABLE_CONTENT` (422), `TOO_MANY_REQUESTS` (429), `CLIENT_CLOSED_REQUEST` (499), `INTERNAL_SERVER_ERROR` (500), `NOT_IMPLEMENTED` (501), `BAD_GATEWAY` (502), `SERVICE_UNAVAILABLE` (503), and `GATEWAY_TIMEOUT` (504).

### Action context

The terminal handler or stream receives only the values enabled by its chain and project:

| Value             | Available when                                | Meaning                                                                       |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `input`           | `.input()` is present                         | Parsed schema output.                                                         |
| `db`              | `db/schema.ts` exists                         | Typed Drizzle client; relational queries come from `db/relations.ts`.         |
| `auth`            | `auth.ts` exists                              | better-auth instance; it does not authenticate automatically.                 |
| `env`             | `env.ts`, `db/schema.ts`, or `auth.ts` exists | Parsed custom env outputs plus automatic database/auth keys.                  |
| `publisher`       | `publisher.ts` exists                         | Publisher typed from declared event names and schemas.                        |
| `reqHeaders`      | Every action                                  | Incoming `Headers \| undefined`; guard it before APIs that require headers.   |
| Middleware values | Earlier `.use()` returns them                 | Fully typed values merged into downstream middleware and the terminal method. |

A stream also receives `signal: AbortSignal | undefined` and `lastEventId: string | undefined`.

### Middleware

Each `.use(fn)` runs before the terminal method. Its returned object is merged into later middleware and the handler/stream. `input` is unavailable inside middleware and is added only for the terminal method.

```ts
import { ServerError } from 'typebase-io/server';
import { action } from '../_generated/server.ts';

export const authedAction = action.use(async ({ auth, reqHeaders }) => {
  if (!reqHeaders) throw new ServerError('UNAUTHORIZED');

  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session || !session.user) throw new ServerError('UNAUTHORIZED');

  return { user: session.user };
});
```

Reuse the returned builder for protected actions so `user` is typed. Middleware can return any context values, not only auth data.

### Streaming actions

`.stream()` takes an async generator. `.output()` describes one yielded event, not the whole stream.

```ts
export const getMany = action.output(todoShape.array()).stream(async function* ({ db, publisher, signal, lastEventId }) {
  const created = await publisher.subscribe('todo.created', { signal, lastEventId });

  yield await readTodos(db);

  for await (const _event of created) {
    yield await readTodos(db);
  }
});
```

- A stream must yield at least once. Yield events; do not `return value`. A bare `return;` may end it.
- Subscribe before the initial snapshot read. This may repeat a snapshot but avoids losing an event between the read and subscription.
- Pass optional `signal` to subscriptions, fetches, and other long work; check it with optional-safe logic such as `signal?.aborted`. Put cleanup in `finally`.
- `lastEventId` is absent on first connect. Pass it to the publisher to replay retained events after a reconnect.
- `withEventMeta(value, { id, retry })` attaches SSE metadata; `id` must be a string and `retry` is milliseconds. `getEventMeta(value)` reads it. Publisher events already carry their row id.
- Clients do not reconnect by default. Enable a retry plugin if resumption is required.

## Database

Define tables with `p` from `typebase-io/db`; it re-exports Drizzle PostgreSQL schema helpers. `q` re-exports Drizzle query/relations helpers.

```ts
import { p } from 'typebase-io/db';

export const todos = p.pgTable('todos', {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.text().notNull(),
  completed: p.boolean().default(false).notNull(),
  createdAt: p.timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

```ts
import { q } from 'typebase-io/db';
import * as schema from './schema.ts';

export const relations = q.defineRelations(schema, (r) => ({
  todos: {},
}));
```

`.references()` creates a PostgreSQL foreign key. `relations.ts` only configures relational query ergonomics and does not create constraints.

### Decide push or migrations before touching a schema

**Check for `<tb>/db/migrations/` first.** Its presence is the only switch, and the two modes are mutually exclusive:

| `<tb>/db/migrations/` | Mode            | Apply a schema change with                           |
| --------------------- | --------------- | ---------------------------------------------------- |
| absent                | push mode       | `db <target> push`                                   |
| present               | migrations mode | `db migrations generate`, then `db <target> migrate` |

In migrations mode `push` hard-errors and names the `migrate` command, so reaching for it is a wasted step. Never create or delete that folder to switch modes: use `db migrations init` to adopt migrations, and never delete it to escape them.

In migrations mode the loop is: edit `schema.ts` → `db migrations generate --name "<what changed>"` → read the generated `migration.sql` → `db dev migrate`. Generating is offline and contacts no database; applying is the step that writes. Never hand-edit a migration that has already been applied to any target, and never edit `snapshot.json`. Use `db migrations generate --custom` for backfills, data migrations, and anything a schema diff cannot express. If generate reports a forked history, resolve it by deleting all but one of the competing migrations and regenerating; only pass `--ignore-conflicts` with explicit user authorization. `deploy` refuses outright when schema files hold changes no migration records, so generate before deploying.

After schema edits, test with `db dev push` (push mode) or `db dev migrate` (migrations mode) before production. A deploy pushes or applies migrations for the target automatically. A first standalone push is interactive and can authenticate to Neon, select/create a project and branch, persist IDs/credentials, and mutate remote state; verify `.env` is ignored and use the user's authorized target/project. Run a prod push only when production was explicitly requested. Never accept a destructive warning without explicit user authorization; dropped data is unrecoverable. Treat `schema.ts` as the source of truth: use Neon UI for inspection, reads, and intentional data fixes, not schema edits that create drift.

## Publisher and realtime

Declare typed, object-shaped event payloads in `<tb>/publisher.ts`:

```ts
import { definePublisher } from 'typebase-io/server';
import { z } from 'zod';

export const publisher = definePublisher({
  provider: 'db',
  events: {
    'todo.created': z.object({ id: z.number(), value: z.string() }),
  },
});
```

The database provider is the only provider. Existing projects must add this exact table shape:

```ts
export const events = p.pgTable(
  'events',
  {
    id: p.bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: p.text().notNull(),
    value: p.jsonb().notNull(),
    createdAt: p.timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [p.index('events_name_id_idx').on(table.name, table.id)]
);
```

Also register `events: {}` in relations and push the schema. `init --with-db-publisher` scaffolds the publisher, table, publishing mutation, and stream.

- `publisher.publish(name, payload)` validates and stores the parsed payload. Invalid payloads throw `INTERNAL_SERVER_ERROR`.
- When an event describes work inside a DB transaction, pass `{ tx }` to `publish`; otherwise a rollback could leave a false event behind.
- `publisher.subscribe(name, { signal, lastEventId })` is an async generator. Without `lastEventId`, it starts at the newest event and replays no history.
- Defaults: `pollIntervalMs: 1000`, `maxBufferedEvents: 100`, `batchSize: 100`. The buffer delays later rows rather than dropping them.
- The provider polls PostgreSQL. Lower intervals cost one query per interval per active instance.
- Nothing prunes the `events` table. Schedule retention deliberately; deleted events cannot be replayed.
- The CLI reads `definePublisher` statically. Keep the call/config resolvable and write `provider` as a plain string.

Typebase realtime is explicit event publishing plus SSE streams. It is not automatic table-change subscription, a reactive-query system, broadcast channels, or presence.

## Authentication

`defineAuth` accepts better-auth options except `database`, which Typebase owns:

```ts
import { defineAuth } from 'typebase-io/server';

export const auth = defineAuth({
  trustedOrigins: ['http://localhost:3000'],
  emailAndPassword: { enabled: true },
});
```

After creating or changing `auth.ts`, run `auth generate`, then `db dev push` (push mode), `db dev migrate` (migrations mode), or `deploy dev`. `auth generate` requires both `auth.ts` and the schema; it adds/updates auth tables, relations, `BETTER_AUTH_SECRET`, and generated types. If `db pull` overwrites auth tables and the pulled database lacks them, rerun `auth generate` before pushing.

Import bundled server plugins from `typebase-io/server/auth-plugins` and matching client plugins from `typebase-io/client/auth-plugins`; do not add better-auth directly. Plugins distributed as separate packages, such as `@better-auth/expo`, still come from their package.

## Environment variables

Declare required server variables with statically resolvable Standard Schemas:

```ts
import { defineEnv } from 'typebase-io/server';
import { z } from 'zod';

export const env = defineEnv({
  RESEND_API_KEY: z.string().min(1),
  RETRY_LIMIT: z.coerce.number().int().positive(),
});
```

Custom keys have their schema's parsed output type; they are not necessarily strings. By default the generated server validates them at boot. Options are `emptyStringAsUndefined` (default `true`) and `skipValidation` (default `false`).

`DATABASE_URL` is automatic when a schema exists and `BETTER_AUTH_SECRET` is automatic when auth exists. They are required strings unless their schemas are overridden in `env.ts`. Do not redeclare them merely to read them.

Declaration and storage are separate:

- Editing `env.ts` adds parsing, types, and boot validation; it does not set a provider/local value.
- `env <target> add KEY value` sets the provider value; it does not edit `env.ts` or local `.env`. Vercel and Deno use it on the next deploy; Cloudflare updates the live Worker immediately.
- Local generated servers read `<tb>/_server/.env`.

The CLI statically reads `defineEnv`; use an inline object literal or a local literal variable, not a runtime function. Cloudflare reads Worker bindings while other adapters use `process.env`; the generated `env` context normalizes this.

## Generated code and codegen

Never edit `<tb>/_generated/`.

- `server.ts` exports the mirrored `router`, `Router`, `RouterInputs`, `RouterOutputs`, and configured `action` builder. Database projects also get `getDB()`; use it only in server modules outside actions/streams and use contextual `db` inside them. A stream's `RouterOutputs` entry is its async iterator, the same type whether or not the action declares `.output()`; wrap it in `InferStreamEvent` from `typebase-io/server` (a type-only import) to get one event.
- `db.d.ts` exists only when `db/schema.ts` exists. It exports `DB`; with auth it also exports `AuthSession`.

Run codegen after:

- adding, deleting, or renaming an action file;
- adding or removing `auth.ts`, `env.ts`, `publisher.ts`, `db/schema.ts`, or `db/relations.ts`;
- upgrading `typebase-io` or `typebase-io-cli`.

Editing the contents of an existing file does not require codegen: this includes schema columns, env keys, publisher events, action exports inside an existing file, or changing `.handler()` to `.stream()`. Deploy and generate-server run fresh codegen before type-checking/building.

## CLI reference

Prefer the locally installed binary (`npx typebase-io-cli ...` or the project's script). Main commands:

| Command                                                                              | Agent guidance                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init [-f] [--with-auth] [--with-db-publisher] [--with-migrations] [--skip-example]` | Scaffold only after inspecting every target. A partial backend can be overwritten without `-f`; never run it over existing targets without explicit authorization.                                                                                                              |
| `codegen`                                                                            | Refresh generated router/context types according to the rules above.                                                                                                                                                                                                            |
| `auth generate`                                                                      | Generate auth schema/relations/secret/types; it requires auth and DB schema files. In migrations mode it also records a migration for the tables it adds.                                                                                                                       |
| `db dev push` / `db prod push`                                                       | Push mode only. Push schema to the separate Neon branch. Stop on destructive confirmation. Hard-errors in migrations mode.                                                                                                                                                      |
| `db local push [--url <conn>]`                                                       | Push to any directly connected PostgreSQL; falls back to `DATABASE_URL`.                                                                                                                                                                                                        |
| `db migrations generate [--name <n>] [--custom] [--ignore-conflicts]`                | Migrations mode only. Offline; writes a migration and touches no database. Always pass `--name`. Read the emitted SQL before applying it.                                                                                                                                       |
| `db dev migrate` / `db prod migrate`                                                 | Apply pending migrations to that target. Safe to re-run; each migration runs once per target. Run prod only when production was explicitly requested.                                                                                                                           |
| `db local migrate [--url <conn>]`                                                    | Apply pending migrations to a directly connected PostgreSQL; falls back to `DATABASE_URL`.                                                                                                                                                                                      |
| `db migrations init`                                                                 | Adopt migrations on a push-mode project. Writes to every existing target's bookkeeping table; needs explicit user authorization. Never provisions a target that has no database.                                                                                                |
| `db pull [--url <conn>] [-f]`                                                        | Destructively replaces local schema and relations from the DB, then codegens. It reads `public`; cross-schema references may need cleanup. Warn first and avoid `-f` without explicit approval. In migrations mode it refuses without `-f` and rebaselines history when forced. |
| `deploy dev` / `deploy prod`                                                         | Codegen, validate, build, transpile, push applicable schema, deploy, sync automatic DB/auth variables, and write deployment URL/local connection values.                                                                                                                        |
| `generate-server [options]`                                                          | Build a safe, replaceable snapshot in `<tb>/_server`; rerun after backend changes or use `--watch`.                                                                                                                                                                             |
| `env <dev\|prod> get\|add ...`                                                       | Read/upload provider values after the provider project exists. Encrypted secrets may read as `ENCRYPTED`.                                                                                                                                                                       |
| `logs <dev\|prod>`                                                                   | Long-running provider log stream; stop with `x`/Ctrl+C on a TTY or SIGINT otherwise.                                                                                                                                                                                            |
| `config`                                                                             | Read-only `{ projectRoot, configPath, schema }` config snapshot; the only command not requiring `typebase-io`.                                                                                                                                                                  |

`typebase.json` stores `$schema`, `projectPath`, server output/adapter/port/output directory, provider choice, and provider IDs. Let deploy write real provider IDs; never invent them.

### Deploy safety

First deploys are interactive and there is no `--yes` flag. Use a PTY if automating, but match and handle each prompt explicitly:

- Default to `dev`; deploy `prod` only when the user requested production.
- Selecting/creating external provider and Neon projects is an external state change. Use the user's explicit target or surface the choice.
- Never blindly send Enter when idle. Stop and ask before destructive schema changes or disabling Vercel protection.
- Provider/Neon tokens may be stored in project-root `.env`. Verify `.env` is ignored before authentication or persisting credentials; prefer process environment values when practical.
- A later deploy is usually non-interactive only while saved provider IDs/credentials remain valid and the schema diff is non-destructive.

#### PTY and `CI=1`

First-time deploy and database setup need a real PTY because `@inquirer/prompts` checks `stdin.isTTY`. Set `CI=1` (or `TERM=dumb`) when driving that PTY: this disables `ora` animation without disabling prompts. Without it, spinner redraws can produce hundreds of megabytes of ANSI output, fill the PTY buffer, and make a working command appear hung. `CI=1` does **not** approve prompts or make the CLI non-interactive.

Keep draining stdout and do not pipe the CLI through a slow filter. A cold deploy runs codegen, TypeScript validation, server generation, and transpilation before provider prompts, so it can take several minutes. Match actual prompt text; never interpret a quiet timeout as permission to send Enter.

#### First-run prompt and default matrix

Selections use the first choice when Enter is pressed, while `confirm()` defaults to yes unless the command passes `default: false`. Defaults that create resources or weaken/delete state are documented here so an agent can recognize them, not so it can accept them blindly.

| Prompt                     | When it appears / Enter behavior                                                                         | Safe bypass or handling                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Select deploy provider     | No saved `serverProvider` and no flag; first choice is `vercel`.                                         | Use the user-authorized `--provider vercel\|cloudflare\|deno`, or an existing saved provider.                        |
| Provider token/API key     | Credential is absent; required input with no default.                                                    | Supply `VERCEL_TOKEN`, `CLOUDFLARE_API_TOKEN`, or `DENO_DEPLOY_TOKEN` through the process environment.               |
| Neon API key               | Only for a project with `db/schema.ts`; required input with no default.                                  | Supply `NEON_API_KEY` through the process environment.                                                               |
| Select Neon organization   | Only when the token has multiple organizations; one is selected automatically, zero exits.               | Select the authorized organization; never invent `neon.orgId`.                                                       |
| Select Neon project        | With existing projects, first choice is `+ Create a new Neon project`; with none, creation is automatic. | Select the authorized existing project or explicitly authorize creation; an existing saved `neon` block skips setup. |
| Neon project name          | Creating a project; defaults to `basename(cwd)`.                                                         | Confirm or provide the intended name.                                                                                |
| Neon region                | Creating a project; first choice is `US East (Ohio)` (`aws-us-east-2`).                                  | Select the intended data region explicitly.                                                                          |
| Select Vercel project      | With existing projects, first choice is `+ Create a new project`; with none, creation is automatic.      | Select/authorize the target; a saved `vercel` block skips setup.                                                     |
| Vercel project name        | Creating a project; defaults to `basename(cwd)`.                                                         | Confirm or provide the intended name.                                                                                |
| Disable Vercel protections | Only for an existing protected project; Enter means **yes**.                                             | Stop unless disabling protection was explicitly authorized.                                                          |
| Select Cloudflare account  | Only with multiple accounts; Enter selects the first.                                                    | Select the authorized account; a saved `cloudflare` block skips setup.                                               |
| Select Cloudflare Worker   | With existing Workers, first choice is `+ Create a new worker`; with none, creation is automatic.        | Select/authorize the target Worker.                                                                                  |
| Cloudflare Worker name     | Creating a Worker; defaults to `basename(cwd)`.                                                          | Confirm or provide the intended name.                                                                                |
| Deno organization slug     | Always needed during unsaved Deno setup; required input with no default.                                 | Read the exact slug from the Deno dashboard.                                                                         |
| Select Deno app            | With existing apps, first choice is `+ Create a new app`; with none, creation is automatic.              | Select/authorize the target app; a saved `deno` block skips setup.                                                   |
| Deno app name              | Creating an app; defaults to `basename(cwd)`.                                                            | Confirm or provide the intended name.                                                                                |
| Apply schema changes?      | Only when Drizzle returns warnings; Enter means **yes**.                                                 | Show the warnings and require explicit authorization. Never accept automatically.                                    |

After successful setup, the CLI persists `serverProvider` and real provider/Neon IDs in `typebase.json`; later runs skip those selectors. Do not hand-write or guess IDs. Credential expiry, missing configuration, or warned schema changes can still make later runs interactive.

Only projects with `db/schema.ts` need Neon/`DATABASE_URL`; only auth projects need `BETTER_AUTH_SECRET`. Custom keys in `env.ts` are not synced by deploy; required keys without schema defaults must already be set unless validation is intentionally skipped. Schema push occurs before new server code goes live, so stage destructive production changes additively across releases.

Dev and prod have separate deployment URLs, provider env vars, and Neon branches. Project `.env` uses `TYPEBASE_APP_URL_DEV`/`DATABASE_URL_DEV` for dev and `TYPEBASE_APP_URL`/`DATABASE_URL` for prod. Browser code instead needs framework-public variables.

### Logs and local servers

`logs` and `deploy --logs` are long-running; do not use them in one-shot runs. Provider behavior differs: Vercel is delayed and preserves only the first `console.log` per request; Deno streams logged lines but requests with no log may be invisible; Cloudflare tails quickly and needs Node 22.4+. Restart Vercel/Deno logs after redeploy; Cloudflare follows the Worker name.

For local execution, `generate-server` writes a snapshot to the configured `server.outDir` (default `_server` under `<tb>`), preserving its `.env` and `node_modules` on regeneration. Install/run from that output, set required values in its `.env`, use `DATABASE_URL_DEV` as local `DATABASE_URL` when targeting dev, trust the localhost frontend origin, and point the frontend to the local port. `--watch` rebuilds but does not restart the running server; run it with a persistent session or timeout and stop it cleanly.

## Frontend clients

Frontend code lives outside `<tb>/` and imports only generated types.

```ts
import { createRouterClient } from 'typebase-io/client';
// Replace this path with the actual relative path to <tb>.
import type { Router } from '../../src/typebase/_generated/server';

export const client = createRouterClient<Router>({
  url: process.env.TYPEBASE_APP_URL_DEV || process.env.TYPEBASE_APP_URL || '',
});
```

Use `createRouterClient` for plain async calls and `createTanstackQueryClient` for TanStack Query. When `url` is a string, both trim trailing slashes and append `/rpc` unconditionally, so pass the server base URL and never a string already ending in `/rpc`. Non-string URL values, such as a `URL` object or resolver function, are passed through unchanged; a `URL` must already contain `/rpc`, and a resolver must return the full RPC endpoint. Browser URLs must use public env configuration (`NEXT_PUBLIC_`, `PUBLIC_`, `EXPO_PUBLIC_`, or Nuxt `runtimeConfig.public`).

TanStack action nodes expose `queryOptions()`, `mutationOptions()`, and `key()`. Install the framework's `QueryClientProvider` before using hooks, and preserve its SSR hydration setup. Next.js uses a client provider and dehydration boundary where applicable; SvelteKit uses Svelte Query's provider; Nuxt uses a Vue Query plugin with hydrate/dehydrate; Expo also wires focus and network lifecycle.

Before using `consumeStream`, create or import a client. Pass `client.queries.todos.getMany()` when it came from `createRouterClient`; a TanStack client wraps procedures, so pass `client.queries.todos.getMany.call()` when it came from `createTanstackQueryClient`:

```ts
import { consumeStream, createRouterClient, createTanstackQueryClient } from 'typebase-io/client';
import type { Router } from '../../src/typebase/_generated/server'; // Use the actual relative path to <tb>.

// Choose the client that fits the caller; both need the generated Router type.
const routerClient = createRouterClient<Router>({ url: '...' });
const tanstackClient = createTanstackQueryClient<Router>({ url: '...' });

// createRouterClient
const stopRouterStream = consumeStream(routerClient.queries.todos.getMany(), {
  onEvent: (todos) => render(todos),
  onError: (error) => console.error(error),
  onSuccess: () => console.log('stream ended'),
});

// createTanstackQueryClient
const stopTanstackStream = consumeStream(tanstackClient.queries.todos.getMany.call(), {
  onEvent: (todos) => render(todos),
  onError: (error) => console.error(error),
  onSuccess: () => console.log('stream ended'),
});

// Call the matching function when the subscription's owner stops or unmounts.
// void stopRouterStream();
// void stopTanstackStream();
```

`consumeStream` starts consuming immediately, and every call creates a distinct long-lived subscription. In UI code, create it from the framework's mount lifecycle and call its async unsubscribe function during cleanup. Never call it while rendering a component. In React, use `useEffect`; `useRef(consumeStream(...))` is also wrong because the `useRef` argument is evaluated on every render:

```tsx
useEffect(() => {
  const unsubscribe = consumeStream(tanstackClient.queries.todos.getMany.call(), {
    onEvent: (todos) => setTodos(todos),
    onError: (error) => console.error(error),
  });

  return () => {
    void unsubscribe();
  };
}, []);
```

Alternatively, `for await` the resulting async iterable. Provide `onError` or `onFinish` to avoid unhandled failures. `onSuccess` also runs after unsubscribe, and `onFinish` runs after success/error. To keep a long-lived stream reconnecting/resuming, use a client dedicated to streams and add `ClientRetryPlugin` from `typebase-io/client/plugins` with `new ClientRetryPlugin({ default: { retry: Number.POSITIVE_INFINITY } })`. That global default applies to every call on that client, so do not share it with non-idempotent mutations that could be repeated after an ambiguous failure. All oRPC client plugins are re-exported there. Custom server plugins are unsupported.

### Web auth and request forwarding

Use `createAuthClient` from `typebase-io/client/auth/react`, `typebase-io/client/auth/svelte`, or `typebase-io/client/auth/vue`. Each framework helper module—`typebase-io/client/auth/nextjs`, `typebase-io/client/auth/svelte-kit`, and `typebase-io/client/auth/nuxt`—exports `proxyToTypebase`, `getServerSession`, and `getServerAuthCookie`.

Proxy auth through the frontend origin so secure HttpOnly cookies are first-party. RPC must also be proxied whenever browser RPC clients point at that same origin:

| Framework | Required shape                                                                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js   | Proxy `/api/auth`; proxy `/rpc` for browser/TanStack RPC. A server-only simple client may call Typebase directly with `headers: async () => getServerAuthCookie()`. Older Next.js uses `middleware.ts` and must rename the exported `proxy` function to `middleware`. |
| SvelteKit | Proxy `/api/auth`; proxy `/rpc` when browser RPC uses the app origin. A server simple client forwards `getServerAuthCookie(getRequestEvent())`. Server auth requests use the request-bound `getRequestEvent().fetch`.                                                 |
| Nuxt      | Proxy both `/api/auth` and `/rpc`. Browser RPC uses `window.location.origin`; server RPC uses the Typebase provider URL and forwards `useRequestEvent()?.headers`.                                                                                                    |

For any universal/SSR client, branch browser/server URL and request plumbing correctly. Do not read a server-only env value in browser code, and do not drop incoming cookies during SSR. Add every real frontend origin to `trustedOrigins`.

### Expo auth

Expo has no proxy. Install `@better-auth/expo` and `expo-secure-store`; add `expo()` to server auth and `expoClient({ scheme, storagePrefix, storage: SecureStore })` to `createAuthClient`. Set the auth client's `baseURL` to `EXPO_PUBLIC_TYPEBASE_APP_URL` and send its stored cookie on RPC calls:

```ts
export const client = createTanstackQueryClient<Router>({
  url: process.env.EXPO_PUBLIC_TYPEBASE_APP_URL || '',
  headers: () => ({ cookie: authClient.getCookie() }),
});
```

Keep `app.json` scheme, plugin scheme/storage prefix, and trusted origins aligned. Include the custom scheme and the development/physical-device origins used by the app; Expo Go commonly needs `exp://` patterns.

## Common failure modes

- Missing `db`, `auth`, `env`, or `publisher` context: resolve `<tb>`, check the enabling file, and rerun codegen if its presence changed.
- `db.query.X` missing or “no relations found”: register the table in `db/relations.ts`, even as `{}`.
- “relation does not exist”: schema code changed but the target database was not pushed.
- Publisher build failure: add the canonical `events` table/relations, or make `definePublisher` statically resolvable.
- Boot-time invalid env: declare the right schema and set the value in the correct provider target or local generated-server `.env`. Respect `skipValidation` if intentionally configured.
- Auth sign-in fails after setup: run `auth generate`, push its tables, verify first-party cookie proxy/Expo cookie forwarding, and check exact trusted origins.
- `/rpc/rpc` 404: a string `url` already included `/rpc`; string inputs must be the server base URL. Non-string URL values are not modified and must target the full RPC endpoint themselves.
- `env get` says `ENCRYPTED`: retrieve the original secret from its authoritative provider; the CLI cannot reveal it.
- Destructive warning after a rename: stop. Drizzle may interpret it as drop/add; do not accept data loss merely to complete a command.
- Dependency installation issue: diagnose the exact package-manager error first. Only use the documented Drizzle peer workaround for the matching strict peer-range failure; esbuild setup differs across pnpm, Yarn, Bun, and npm script settings.
- Cloudflare CPU limit during password auth: better-auth's default JS scrypt can exceed the free Worker CPU budget. Prefer configuring a native `node:crypto` hasher before real users exist or choose a suitable paid limit; changing hash format later invalidates existing passwords without migration.

## Capability boundaries

Do not invent Typebase APIs for storage, mailers, custom domains per environment, migration files, custom oRPC server plugins, automatic database subscriptions, broadcast, or presence. Use a normal server-side TypeScript library from an action when appropriate, or explain the current limitation.

When this skill lacks an edge case, use the current official Typebase docs as the authority, then the underlying oRPC, Drizzle, and better-auth docs:

- <https://typebase.io>
- <https://orpc.dev>
- <https://orm.drizzle.team>
- <https://www.better-auth.com>
