---
name: typebase
description: Write, deploy, and consume a Typebase backend — TypeScript actions, Drizzle schema, and better-auth — from inside a `typebase/` directory in an existing JS/TS project. Use when the project depends on `typebase-io` or `typebase-io-cli`, when a `typebase/` directory exists, when a `typebase.json` is present, or when the user mentions Typebase, the `action` builder, `defineAuth`, `defineEnv`, `db/schema.ts`, `db/relations.ts`, or running `typebase-io-cli` (init, codegen, deploy, db push, auth generate, env, logs, generate-server).
---

# Typebase

Typebase turns a `typebase/` directory of TypeScript files into a deployed, type-safe HTTP server that the frontend calls like local async functions. It is built on **oRPC** (RPC + types), **Drizzle ORM** (Postgres), and **better-auth** (auth). Server code is deployed to Vercel, Cloudflare Workers, or Deno Deploy. The database is provisioned on Neon.

When the user asks to add an endpoint, you drop a file in `typebase/actions/`. Adding a column means editing `typebase/db/schema.ts`. There is no REST/GraphQL boilerplate, no manual client generation, no separate type package — the client gets its types from `typebase/_generated/server.ts`.

## When to apply this skill

- The project contains `typebase-io` or `typebase-io-cli` in `package.json`, or a `typebase/` directory, or a `typebase.json` file.
- The user mentions Typebase, "actions", `defineAuth`, `defineEnv`, `db/schema.ts`, `db/relations.ts`, or any `typebase-io-cli` command.
- The user wants to "add a backend endpoint", "add a database table", "add auth", or "deploy the backend" in a project that fits the patterns above.

If none of those apply, this is the wrong skill.

## Mental model

```
your-app/
├── src/                       ← frontend (Next.js, SvelteKit, Nuxt, Expo, anything)
└── typebase/                  ← backend — deployed as a standalone HTTP server
    ├── _generated/            ← auto-written by `codegen`. Never edit.
    ├── db/
    │   ├── schema.ts          ← Drizzle tables (Postgres)
    │   └── relations.ts       ← every table must be registered here
    ├── actions/
    │   ├── queries/*.ts       ← reads (convention only)
    │   └── mutations/*.ts     ← writes (convention only)
    ├── auth.ts                ← optional, better-auth config
    ├── env.ts                 ← optional, declared + validated env vars
    └── tsconfig.json
```

Hard rules:

- **`typebase/` runs on the server only.** The frontend cannot import runtime code from it; only types. The backend cannot import from the frontend.
- **The folder structure of `actions/` is the API.** `actions/queries/todos.ts` exporting `getOne` becomes `client.queries.todos.getOne` on the frontend. `queries`/`mutations` are pure convention — flat or nested folders work too. Only exports that are full Typebase/oRPC procedures end up on the client; helpers next to them are fine.
- **Files in `typebase/` can import each other freely.** Add utilities, shared types, helpers anywhere alongside your actions, schema, or auth.
- **`auth.ts` requires `db/schema.ts`.** better-auth keeps users and sessions in the database, so there is no auth-without-db shape. `codegen`, `generate-server`, `deploy`, and `auth generate` all refuse to run on a project that has one without the other. Adding auth to a db-less project means adding a schema first.
- **Codegen is required when files appear/disappear/rename**, not when their contents change. See "Codegen rules" below.
- **No type escape hatches.** Typebase's entire value is that types flow from `db/schema.ts` through actions to the frontend client. Never use `as` casts (the type-safe `as const` is fine), `any`, or `@ts-ignore`/`@ts-expect-error` — not in `typebase/` and not in frontend code consuming the client. If a type doesn't line up, fix the code, not the type: the mismatch is usually a missing `.notNull()`, a table not registered in `relations.ts`, stale codegen, or a handler returning a shape that doesn't match `.output()`.

## File: `typebase/actions/**/*.ts`

Build an action by chaining `.input()` → `.output()` → `.handler()` on the `action` import from `_generated/server.ts`. Throw `ServerError` from `typebase-io/server` for HTTP errors.

```ts
import { ServerError } from 'typebase-io/server';
import { z } from 'zod';

import { action } from '../../_generated/server.ts';
import { todos } from '../../db/schema.ts';

export const getOne = action
  .input(z.object({ id: z.number() }))
  .output(z.object({ id: z.number(), value: z.string(), completed: z.boolean() }))
  .handler(async ({ db, input }) => {
    const todo = await db.query.todos.findFirst({ where: { id: input.id } });
    if (!todo) throw new ServerError('NOT_FOUND');
    return { id: todo.id, value: todo.value, completed: todo.completed };
  });
```

- `.input()` and `.output()` are optional. Both accept any [Standard Schema](https://standardschema.dev/) library — Zod, Valibot, ArkType.
- If `.output()` is omitted, the return type is inferred from the handler. The client still has full types; you just lose runtime output validation.
- The handler context contains only what the project has configured:
  - `input` — present iff `.input()` was used.
  - `db` — present iff `typebase/db/schema.ts` exists. A typed Drizzle client.
  - `auth` — present iff `typebase/auth.ts` exists. The better-auth instance.
  - `env` — present iff `typebase/env.ts`, `db/schema.ts`, or `auth.ts` exists. Validated env vars, each a plain `string`. See "File: `typebase/env.ts`".
  - `reqHeaders` — always passed; may be `undefined`. Needed for `auth.api.getSession({ headers: reqHeaders })`.
- Prefer `env.X` over `process.env.X` for anything the server needs to run. `process.env` still works anywhere inside `typebase/` for optional values.

`ServerError` codes (string → HTTP): `BAD_REQUEST`(400), `UNAUTHORIZED`(401), `FORBIDDEN`(403), `NOT_FOUND`(404), `METHOD_NOT_SUPPORTED`(405), `TIMEOUT`(408), `CONFLICT`(409), `PRECONDITION_FAILED`(412), `PAYLOAD_TOO_LARGE`(413), `UNPROCESSABLE_CONTENT`(422), `TOO_MANY_REQUESTS`(429), `INTERNAL_SERVER_ERROR`(500), `NOT_IMPLEMENTED`(501), `SERVICE_UNAVAILABLE`(503). Pass an optional `{ message }` as a second arg.

There is no technical difference between a query and a mutation — both are actions. The split is organizational only.

## Middleware: `action.use()`

Each `.use(fn)` runs before the handler. The object it returns is merged into the context for downstream `.use()`s and the handler. Note: `input` is **not** available inside `.use()`, only inside `.handler()`.

The canonical pattern is a reusable `authedAction` builder:

```ts
// typebase/actions/_custom-actions.ts (any name; place it inside typebase/)
import { ServerError } from 'typebase-io/server';
import { action } from '../_generated/server';

export const authedAction = action.use(async ({ reqHeaders, auth }) => {
  if (!reqHeaders) throw new ServerError('UNAUTHORIZED');
  const sessionData = await auth.api.getSession({ headers: reqHeaders });
  if (!sessionData?.session || !sessionData?.user) throw new ServerError('UNAUTHORIZED');
  return { user: sessionData.user };
});
```

Then in any protected action:

```ts
import { authedAction } from '../_custom-actions';

export const create = authedAction.input(z.object({ value: z.string() })).handler(async ({ db, input, user }) => {
  /* user is fully typed */
});
```

## File: `typebase/db/schema.ts`

Tables are defined with `p.pgTable()` from `typebase-io/db`. `p` re-exports Drizzle's pg-core (column types and helpers); `q` re-exports `drizzle-orm` (query helpers, relations).

```ts
import { p } from 'typebase-io/db';

export const users = p.pgTable('users', {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  name: p.varchar({ length: 255 }).notNull(),
  email: p.varchar({ length: 255 }).notNull().unique(),
});

export const todos = p.pgTable('todos', {
  id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  value: p.varchar({ length: 255 }).notNull(),
  completed: p.boolean().notNull(),
  createdAt: p.timestamp().notNull().defaultNow(),
  userId: p
    .integer()
    .notNull()
    .references(() => users.id),
});
```

- Common types: `p.integer`, `p.text`, `p.varchar({ length })`, `p.boolean`, `p.timestamp`, `p.json`, `p.uuid`, `p.serial`, `p.real`.
- Common modifiers: `.primaryKey()`, `.notNull()`, `.unique()`, `.default(v)`, `.defaultNow()`, `.generatedAlwaysAsIdentity()`, `.references(() => other.id)`.
- `.references()` creates the actual foreign key in Postgres. `relations.ts` only adds query ergonomics — it does **not** add DB constraints.
- If the project doesn't need a database, delete the entire `typebase/db/` directory. Actions without `db` work fine.

## File: `typebase/db/relations.ts`

**Every table exported from `schema.ts` must appear here, even with `{}`.** This file is what powers `db.query.X` (the relational query API). Forgetting a table causes "no relations found" at runtime.

```ts
import { q } from 'typebase-io/db';
import * as schema from './schema.ts';

export const relations = q.defineRelations(schema, (r) => ({
  users: { todos: r.many.todos() },
  todos: {
    user: r.one.users({ from: r.todos.userId, to: r.users.id }),
  },
  // standalone tables still need a registration:
  logs: {},
}));
```

## File: `typebase/auth.ts` (optional)

```ts
import { defineAuth } from 'typebase-io/server';

export const auth = defineAuth({
  trustedOrigins: ['http://localhost:3000'],
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
  },
});
```

`defineAuth` accepts every better-auth option except `database` (Typebase manages it). The project must already have a `db/schema.ts` — creating `auth.ts` in a db-less project makes every CLI command fail until you add one. After creating or modifying `auth.ts`:

1. Run `npx typebase-io-cli auth generate` — appends `users`, `sessions`, `accounts`, `verifications` tables to `db/schema.ts`, registers them in `db/relations.ts`, writes `BETTER_AUTH_SECRET` to `.env` if missing, and reruns codegen.
2. Run `npx typebase-io-cli db dev push` (or just `deploy dev`) so the new tables exist in the database. Sign-in failures with auth "configured but tables missing" almost always mean step 2 was skipped.

`auth generate` requires both `auth.ts` and `db/schema.ts` to exist already.

### better-auth plugins

Every built-in better-auth plugin is re-exported through Typebase — import server plugins from `typebase-io/server/auth-plugins` and the matching client plugins from `typebase-io/client/auth-plugins`. There is no need to add `better-auth` as a direct dependency.

```ts
// typebase/auth.ts
import { defineAuth } from 'typebase-io/server';
import { admin, magicLink } from 'typebase-io/server/auth-plugins';

export const auth = defineAuth({
  plugins: [admin(), magicLink({ sendMagicLink: async ({ email, url }) => {} })],
});

// frontend auth client
import { createAuthClient } from 'typebase-io/client/auth/react';
import { adminClient, magicLinkClient } from 'typebase-io/client/auth-plugins';

export const authClient = createAuthClient({ plugins: [adminClient(), magicLinkClient()] });
```

These paths re-export `better-auth/plugins` and `better-auth/client/plugins` verbatim. Plugins shipped as separate packages (e.g. `@better-auth/expo`) are still imported from their own package.

## File: `typebase/env.ts` (optional)

Declares the env vars the server requires. They are validated **at boot** (the generated server exits before serving a request if any is missing) and typed on the handler context as `env`.

```ts
import { defineEnv } from 'typebase-io/server';
import { z } from 'zod';

export const env = defineEnv({
  RESEND_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
});
```

```ts
export const send = action.input(z.object({ to: z.email() })).handler(async ({ env, input }) => {
  // env.RESEND_API_KEY is `string`, never undefined — no `!`, no `?? ''`
});
```

- Any [Standard Schema](https://standardschema.dev/) library works (Zod, Valibot, ArkType), same as `.input()`/`.output()`.
- **`DATABASE_URL` (project has `db/schema.ts`) and `BETTER_AUTH_SECRET` (project has `auth.ts`) are added automatically.** Never declare them just to read them — `env.DATABASE_URL` is typed even in a project with no `env.ts` at all. Declaring one anyway is allowed and your definition wins.
- `env.ts` only says what must exist; it never supplies values. Set them with `env <target> add` on the provider (per target), or in `typebase/_server/.env` locally.
- **Adding a variable is two separate steps, and neither does the other.** `env <target> add KEY value` uploads a value to the provider — it does **not** edit `env.ts`, so the key stays off the `env` context and off the boot check. Editing `env.ts` declares and types the key — it does **not** set a value anywhere. A new variable normally needs both.
- Optional second arg: `{ emptyStringAsUndefined?: boolean (default true), skipValidation?: boolean (default false) }`. Copied into the generated server verbatim, so `skipValidation: process.env.SKIP_ENV_VALIDATION === 'true'` is evaluated at boot.
- The CLI reads this file **statically** — `defineEnv` must be called with an inline object literal or a local variable holding one. `defineEnv(getSchema())` fails the build.
- `init` scaffolds `env.ts` with an empty `defineEnv({})` (skipped by `--skip-example`). An empty schema is fine; deleting the file is fine too (rerun `codegen` after either).
- The generated server reads `process.env` on every adapter except `cloudflare`, where it reads the Worker bindings from `cloudflare:workers`. Both are handled for you — this is why `env.X` works on Cloudflare where `process.env.X` may not.

## File: `typebase/_generated/` (do not edit)

Regenerated by `codegen`. The two files:

- **`_generated/server.ts`** exports `router` (object mirroring `actions/`), `Router` (its type — what the client imports), `RouterInputs` / `RouterOutputs` (type maps mirroring the router — `RouterOutputs['queries']['todos']['getMany']` is what that action returns, `RouterInputs[...]` what it accepts; use these to type props/helpers instead of re-declaring shapes), `action` (the builder, typed against your relations + auth + env), and `getDB()` (returns the Drizzle client; use it from server-side modules **outside** action handlers — inside handlers, use the `db` already on the context).
- **`_generated/db.d.ts`** exports `DB` (`DB['todos']['select']`, `DB['todos']['insert']`) and, when auth is set up, `AuthSession` (`typeof auth.$Infer.Session`).

## CLI: `typebase-io-cli`

Always run via the package script (`npx typebase-io-cli ...`). For CommonJS projects (`"type": "commonjs"` or no `type`), use `typebase-io-cli-cjs` instead — same commands, same flags, just a different module system.

| Command                                                                                                                         | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init [-f] [--with-auth] [--skip-example]`                                                                                      | Scaffold the `typebase/` directory. `-f` overwrites scaffolded files, including example schema, actions, and `env.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `codegen`                                                                                                                       | Regenerate `_generated/`. Run after adding/removing/renaming files in `actions/`, or adding/removing `auth.ts`, `env.ts`, `db/schema.ts`, `db/relations.ts`. **Not** needed when only editing the contents of an existing file (including adding keys to `env.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `auth generate`                                                                                                                 | Append auth tables to `db/schema.ts`, update `db/relations.ts`, set `BETTER_AUTH_SECRET`, rerun codegen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `db dev push` / `db prod push`                                                                                                  | Push schema to the dev / prod Neon branch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `db local push --url <conn>`                                                                                                    | Push schema to a local Postgres (or any Postgres you connect to directly). Falls back to `DATABASE_URL` from env if `--url` is omitted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `deploy dev` / `deploy prod`                                                                                                    | Validate types → run `codegen` → generate server → transpile → push schema → deploy → sync `DATABASE_URL` and `BETTER_AUTH_SECRET` → save URL to project `.env`. Only those two are synced: anything declared in `env.ts` must already be set with `env <target> add`, or the deployed server won't boot. `--provider vercel\|cloudflare\|deno` skips the prompt. **Interactive on first run** — to drive it as an agent see "Headless / AI-driven deploy" below. Add `--logs` to tail the server right after the deploy goes live (same stream as `logs`, so it runs until stopped — never add it to a one-shot agent run).                                                                                                                                                                                                                                                                    |
| `generate-server [--output ts\|esm\|cjs] [--adapter node\|bun\|hono\|fastify\|deno\|cloudflare] [--port N] [--out-dir _server]` | Reruns `codegen`, type-checks against the fresh types, then builds a runnable server in `typebase/_server/`. Used for self-hosting or local iteration. Snapshot only — re-run after every `typebase/` change. Re-runs replace the output dir (keeping `.env` and `node_modules`); a non-empty dir not generated by Typebase is refused. Emits `src/env.ts` (a validating module compiled from your `defineEnv` schema, not a copy of `env.ts`) whenever the project has `env.ts`, `db/schema.ts`, or `auth.ts`. `dotenv` is added and imported only when that env module exists and the adapter is not `cloudflare` (which reads Worker bindings instead of `process.env`).                                                                                                                                                                                                                     |
| `env <dev\|prod> get <key>`                                                                                                     | Read an env var from the deployment provider. May print `ENCRYPTED` for some providers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `env <dev\|prod> add <key> <value> [--no-encrypted]`                                                                            | Uploads a value to the provider for that target. **Does not** touch `typebase/env.ts` or the local `.env` — declaring the key (so it lands on the `env` context) is a separate edit to `env.ts`. Needs the provider project to already exist, i.e. after a first `deploy`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `logs <dev\|prod>`                                                                                                              | Stream runtime logs from the deployed server until `x`/`X`/Ctrl+C (all three providers; `--provider` skips the prompt). Also available as `deploy <target> --logs`. Delivery differs per provider: **Vercel** polls (~10-20s delay, and only the **first** `console.log` per request survives — combine values into one call), **Deno Deploy** streams (~1-2s, every line, request-scoped lines carry a short trace id, but requests that log nothing never appear), **Cloudflare** tails (sub-second, every line plus exceptions with stacks, needs Node 22.4+). Vercel and Deno pin to the deployment resolved at start, so restart the command after redeploying; Cloudflare follows the Worker by name and survives redeploys. Long-running — as an agent, run it in the background or with a timeout, and remember `x` only works on a TTY: when the output is piped, stop it with SIGINT. |

CLI defaults live in `typebase.json` at the project root. Common fields: `projectPath` (defaults to `src/typebase` if a `src/` exists, else `typebase`), `serverProvider`, `server.{output,adapter,port,outDir}`, plus per-provider blocks (`vercel`, `cloudflare`, `deno`, `neon`) that the CLI fills in automatically after first deploy.

## Headless / AI-driven deploy (driving the CLI without a human)

`deploy` and `db <env> push` are **interactive** (built on `@inquirer/prompts`) and have **no `--yes` / non-interactive flag**. The first deploy needs a pty; after that the CLI has saved the project config and runs non-interactively on its own.

### First deploy: drive a pty

On the first deploy the provider/`neon` blocks don't exist yet, so the CLI asks which project to create or reuse. Provide tokens first (so the token prompts are skipped), then drive it through a pseudo-TTY. **Every "which project?" prompt defaults to "create a brand-new project" as the first choice, so "send Enter whenever the process goes idle" is a complete strategy.**

Tokens needed in env or `.env`: `NEON_API_KEY` (always, for the database) plus the one for your provider — `VERCEL_TOKEN`, `CLOUDFLARE_API_TOKEN`, or `DENO_DEPLOY_TOKEN`.

```bash
# 1. Provide tokens so the API-key/token prompts are skipped (env or .env both work).
printf 'NEON_API_KEY=%s\nVERCEL_TOKEN=%s\n' "$NEON_API_KEY" "$VERCEL_TOKEN" >> .env

# 2. CI=1 silences the ora spinners (see gotcha below); --provider skips the provider prompt.
CI=1 expect -c '
  set timeout 12
  spawn npx typebase-io-cli deploy prod --provider vercel
  expect {
    -re {.+}  { exp_continue }              ;# drain output
    timeout   { send "\r"; exp_continue }   ;# idle => at a prompt => accept default
    eof       {}
  }'
```

### Subsequent deploys: automatically non-interactive

The first successful deploy makes the CLI **write the `serverProvider` and provider/`neon` ID blocks into `typebase.json` for you**. Once they're there, every prompt is skipped and you can deploy with no pty:

```bash
CI=1 npx typebase-io-cli deploy prod
```

(The `db <env> push` "Apply these changes?" confirm still appears, but **only** when Drizzle detects a destructive/warned change — see below.)

**Do not hand-write the `neon`/`vercel`/`cloudflare`/`deno` ID blocks yourself.** They contain real provider IDs (`prj_...`, `org-...`, `team_...`) that you cannot know — inventing plausible-looking values silently targets the wrong project or fails. Let the first pty-driven deploy create and persist them. Only edit these blocks if you have the exact IDs from an authoritative source (the provider's dashboard/API, or the user).

### The `CI=1` gotcha (critical, undocumented elsewhere)

`ora` treats a pty as interactive and animates spinners, emitting **hundreds of MB** of ANSI redraws that flood and stall the driver — the process _looks_ hung when it isn't. Setting `CI=1` (or `TERM=dumb`) makes `is-interactive` return `false`, silencing spinners **without** breaking prompts (prompts key off `stdin.isTTY`, the pty). Also **never pipe the CLI through a slow filter** — if the consumer can't drain fast enough the pty buffer fills and the CLI blocks on its own stdout writes.

### Prompt sequence and the default each one picks

| Prompt                                       | Default (what Enter picks)                                              | Headless bypass                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Select deploy provider                       | —                                                                       | `--provider vercel\|cloudflare\|deno`, or `serverProvider` in `typebase.json`               |
| Provider API token / key                     | —                                                                       | `NEON_API_KEY` + `VERCEL_TOKEN`/`CLOUDFLARE_API_TOKEN`/`DENO_DEPLOY_TOKEN` in env or `.env` |
| Select Neon org                              | only prompts if **> 1** org (1 = auto, 0 = exits)                       | pre-seed `neon.orgId`                                                                       |
| Select Neon project                          | **"+ Create a new Neon project"** (first choice)                        | pre-seed `neon` block                                                                       |
| Neon project name                            | `basename(cwd)`                                                         | —                                                                                           |
| Neon region                                  | **US East (Ohio)** `aws-us-east-2` (first choice)                       | —                                                                                           |
| Select Vercel project                        | **"+ Create a new project"** (first choice)                             | pre-seed `vercel` block                                                                     |
| Vercel project name                          | `basename(cwd)`                                                         | —                                                                                           |
| "Project is protected. Disable protections?" | only for an **existing** protected Vercel project (never on create-new) | use a fresh/unprotected project                                                             |
| "Apply these changes?" (`db push`)           | appears **only on destructive/warned schema hints**; Enter = yes        | avoid destructive diffs, or accept                                                          |

### Read results from files, not the spinner stream

Treat files as the source of truth, not scraped terminal output:

- `TYPEBASE_APP_URL` (prod) / `TYPEBASE_APP_URL_DEV` (dev) → written to the project `.env`.
- `DATABASE_URL`, `BETTER_AUTH_SECRET` → written to `.env` and synced to the provider.
- `neon` / `vercel` (or `cloudflare`/`deno`) ID blocks → written to `typebase.json`.
- Deployment URL + ID are also `console.log`'d at the very end.

### Timing: don't kill a slow run

The pre-prompt phase runs two `tsc` passes plus an esbuild transpile and can take **a few minutes on a cold run** — not a hang. To tell working-from-stuck: a working deploy keeps burning CPU; a deploy genuinely waiting at a prompt goes idle (which is exactly when the pty driver should send Enter).

## Dev vs prod

Two parallel environments, isolated end to end:

|        | Deployment URL                             | Database                | Provider env vars       |
| ------ | ------------------------------------------ | ----------------------- | ----------------------- |
| `dev`  | `TYPEBASE_APP_URL_DEV` (in project `.env`) | Neon dev branch         | own set on the provider |
| `prod` | `TYPEBASE_APP_URL` (in project `.env`)     | Neon prod branch (main) | own set on the provider |

The provider always reads `DATABASE_URL` (one value per env). The project root `.env` keeps both connection strings under different keys so they coexist:

- `DATABASE_URL` → prod branch
- `DATABASE_URL_DEV` → dev branch

Frontend code typically prefers `TYPEBASE_APP_URL_DEV || TYPEBASE_APP_URL` so a dev deploy overrides prod when both are set.

Schema push runs **before** the new server code goes live during deploy. For destructive prod changes, roll out additively first (add nullable column, backfill, deploy code that uses it, then a later deploy drops the old column).

## Frontend client

The client lives outside `typebase/` (in your frontend code). It is a plain TS library — works in any framework. Two flavors:

```ts
// Promise-based, ideal for SSR / server-only
import { createRouterClient } from 'typebase-io/client';
import type { Router } from '../typebase/_generated/server';

export const client = createRouterClient<Router>({
  url: process.env.TYPEBASE_APP_URL_DEV || process.env.TYPEBASE_APP_URL || '',
});

await client.queries.todos.getMany();
await client.mutations.todos.create({ value: 'Buy milk' });
```

```ts
// TanStack Query wrapper, ideal for browser caching
import { createTanstackQueryClient } from 'typebase-io/client';
import type { Router } from '../typebase/_generated/server';

export const client = createTanstackQueryClient<Router>({ url: '...' });

useQuery(client.queries.todos.getMany.queryOptions());
useMutation(
  client.mutations.todos.create.mutationOptions({
    onSuccess: () => {
      /* invalidate */
    },
  })
);
queryClient.invalidateQueries({ queryKey: client.queries.todos.getMany.key() });
```

Both helpers append `/rpc` to the URL automatically. They are thin wrappers over oRPC — drop down to oRPC directly if you need more control. Browser env vars need framework-specific public prefixes: `NEXT_PUBLIC_` (Next.js), `PUBLIC_` (SvelteKit), `EXPO_PUBLIC_` (Expo); Nuxt exposes via `runtimeConfig.public`.

### Auth client + proxy (web)

When the Typebase server is on a different domain than the frontend (the typical case), proxy auth — and `/rpc` if using TanStack Query — through the frontend host so cookies are first-party and `HttpOnly`-secure. This avoids cross-domain cookie issues, especially Safari's third-party cookie limits.

| Framework | Client import                                        | Proxy import                                                                                    | Proxy location                                  |
| --------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Next.js   | `typebase-io/client/auth/react` (`createAuthClient`) | `typebase-io/client/auth/nextjs` (`proxyToTypebase`, `getServerAuthCookie`, `getServerSession`) | `proxy.ts` (or `middleware.ts`) at project root |
| SvelteKit | `typebase-io/client/auth/svelte`                     | `typebase-io/client/auth/svelte-kit`                                                            | `hooks.server.ts`                               |
| Nuxt      | `typebase-io/client/auth/vue`                        | `typebase-io/client/auth/nuxt`                                                                  | `server/middleware/typebase.ts`                 |

Pattern: in the proxy, forward `/api/auth/*` to the Typebase URL. If using the TanStack Query client, also forward `/rpc/*`. With the proxy in place, point the client URL at the current origin in the browser (so requests hit the proxy) and at the Typebase URL on the server (forwarding the session cookie via `headers`).

### Auth client (Expo)

Expo has no SSR and no proxy. Use `@better-auth/expo` for SecureStore session storage. Add `expo()` to `auth.ts` plugins, `expoClient({ scheme, storagePrefix, storage: SecureStore })` to the client. The `scheme` in `app.json`, `trustedOrigins` in `auth.ts` (`'myapp://'`, plus `'exp://'` / `'exp://**'` for Expo Go), and `scheme`/`storagePrefix` in `expoClient` must all match.

## Working locally

Two valid loops; pick one:

1. **Iterate against `dev`** (preferred). Frontend hot-reloads; backend redeploys with `npx typebase-io-cli deploy dev` after server changes. Single source of truth, no env juggling.
2. **Run the server on localhost.** `npx typebase-io-cli generate-server` writes `typebase/_server/`, then `cd typebase/_server && npm install && npx tsx src/index.ts` (default port 8080). Re-run `generate-server` and restart after **any** change in `typebase/` — it is a snapshot, not a watcher. Re-runs replace `typebase/_server/` but keep `.env` and `node_modules`, so the install and env setup survive. Copy `DATABASE_URL_DEV` from project `.env` into `typebase/_server/.env` as `DATABASE_URL`, plus every key declared in `env.ts` (the server exits at boot listing whatever is missing). Add localhost origins to `trustedOrigins`. Point the frontend `TYPEBASE_APP_URL_DEV=http://localhost:8080`.

## Codegen rules (memorize these)

Run `npx typebase-io-cli codegen` whenever any of these change presence:

- A file inside `actions/` is added, removed, or renamed.
- `auth.ts` is added or removed.
- `env.ts` is added or removed.
- `db/schema.ts` or `db/relations.ts` is added or removed.

**Also run it right after upgrading `typebase-io` or `typebase-io-cli`.** `_generated/` is written by the version that generated it, so a folder left over from an older version can describe a context the new runtime doesn't provide. Rerunning `codegen` re-syncs it.

Editing the contents of an existing file does **not** require codegen — types update automatically on the next build. That includes adding or removing keys inside an existing `env.ts`. After running `codegen`, the `db` context property only appears in handlers if `db/schema.ts` exists; same for `auth` and `auth.ts`, and for `env` (which appears when any of `env.ts`, `db/schema.ts`, or `auth.ts` exists).

`deploy dev` / `deploy prod` and `generate-server` all rerun codegen before they build (and type-check against the result), so an explicit `codegen` run is only needed to refresh editor types without rebuilding.

## Common failure modes

- **"`db` is missing from handler context"** → `db/schema.ts` doesn't exist, or `codegen` wasn't rerun after creating it. Same logic for `auth` and `env`.
- **Server exits at boot with `✗ Typebase server failed to start` / "Invalid environment variables"** → a key declared in `env.ts` (or the auto-added `DATABASE_URL`/`BETTER_AUTH_SECRET`) isn't set where the server runs. The message lists exactly which. Fix with `env <target> add <KEY> <value>` + redeploy, or add it to `typebase/_server/.env` + restart locally. This is by design — the server never boots into a half-configured state.
- **Build fails with "no `defineEnv` call was found" / "`defineEnv` must be called with an inline object literal"** → `env.ts` exists but the CLI can't statically read the schema. Use an inline object literal (or a local variable holding one); a schema returned from a function call can't be resolved. An empty `defineEnv({})` is valid; so is deleting `env.ts` and rerunning `codegen`.
- **"No relations found" / `db.query.X` undefined** → table missing from `db/relations.ts`. Add `tableName: {}` if it has no relations.
- **"Relation does not exist" at runtime** → schema added in code but not pushed. Run `db dev push` / `db prod push`, or `deploy dev/prod` (which pushes as part of deploying).
- **Every command fails with "Found `auth.ts` but no database schema at `db/schema.ts`"** → the project has auth but no schema, which cannot be built. Either add `typebase/db/schema.ts` (then `auth generate` + `db dev push`), or delete `typebase/auth.ts` and rerun `codegen`. Usually happens after deleting a schema from a project that had auth.
- **Sign-in fails right after enabling auth** → forgot the `db dev push` after `auth generate`. The auth tables don't exist yet.
- **Sessions don't persist on the frontend** → proxy missing or misconfigured. Cookies must land on the frontend's domain.
- **"Origin not trusted"** → add the exact origin to `trustedOrigins`. For Expo dev, include scheme entries (`myapp://`, `exp://**`).
- **A `console.log` never shows up in `logs` on Vercel** → Vercel's API keeps only the first `console.log` of each request. Combine the values into a single call. On Deno Deploy and Cloudflare every line is delivered.
- **A request never shows up in `logs` on Deno Deploy** → only the Logs API is public, not Traces, so requests that never call `console.log` are invisible. Add a log line to the action, or check the Deno Deploy console's Traces tab.
- **`logs` prints nothing after redeploying** → on Vercel and Deno the stream is pinned to the deployment it resolved at start. Stop it and run it again. Cloudflare tails by Worker name, so it survives redeploys.
- **`env get` returns `ENCRYPTED`** → the provider hides the secret. Read it from the original source (Neon console for `DATABASE_URL`, provider dashboard for `BETTER_AUTH_SECRET`) instead of expecting `env get` to dump it.
- **pnpm refuses to install** → drizzle peer mismatch with better-auth is benign. Add `strict-peer-dependencies=false` to `.npmrc` and reinstall.
- **"esbuild binary missing"** → pnpm/yarn-berry blocked the post-install. `pnpm approve-builds` (pick `esbuild`) or add `pnpm.onlyBuiltDependencies: ["esbuild"]` to `package.json`.
- **Renamed a column and got a destructive-changes prompt** → Drizzle reads renames as drop+add. Cancel, restore the original name, and only then run the rename inside Drizzle's intended workflow (or accept data loss intentionally).
- **Cloudflare Workers `"Worker exceeded CPU time limit"` (503, `outcome: "exceededCpu"`)** → CPU-time budget per request hit. Free plan caps at 10ms, Paid at 30s. Most common cause is **password hashing** during sign-up/sign-in: better-auth's default scrypt is pure JS. Override it in `auth.ts` to use Node's native `scryptSync` (Cloudflare exposes `node:crypto` via the nodejs_compat flag, which Typebase enables by default):

  ```ts
  import { defineAuth } from 'typebase-io/server';
  import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

  export const auth = defineAuth({
    emailAndPassword: {
      enabled: true,
      password: {
        async hash(password) {
          const salt = randomBytes(16).toString('hex');
          return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
        },
        async verify({ hash, password }) {
          const [salt, key] = hash.split(':');
          return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(password, salt, 64));
        },
      },
    },
  });
  ```

  Swapping the hasher invalidates any existing users' passwords — do this before you have real users, or upgrade to the Paid plan instead.

## Decision flowchart for common asks

- "Add a backend endpoint" → create or edit a file in `typebase/actions/...`, export an `action.input(...).output(...).handler(...)`. If it's a brand-new file, run `codegen` afterwards.
- "Add a database table" → edit `typebase/db/schema.ts`, register it in `typebase/db/relations.ts` (even with `{}`), then `db dev push` (no codegen needed for content edits).
- "Add auth" → confirm `typebase/db/schema.ts` exists first (auth cannot be built without one) → create `typebase/auth.ts` → `auth generate` → `db dev push`. Then wire the auth client + proxy in the frontend.
- "Protect an action" → create or import an `authedAction` builder via `action.use(...)` and use it instead of `action`.
- "Read env var on the server" → two steps, both required: (1) declare it in `typebase/env.ts` (`defineEnv`) — this is what puts it on the context as `env.X`; (2) set the value with `npx typebase-io-cli env <target> add KEY value` (provider, per target) or in `typebase/_server/.env` (local). Running only step 2 is the common mistake: the value exists but `env.X` doesn't. `process.env.X` still works for optional values you don't want validated. Never declare `DATABASE_URL`/`BETTER_AUTH_SECRET` just to read them — they're already on `env`.
- "Ship to production" → `npx typebase-io-cli deploy prod`. URL lands in project `.env` as `TYPEBASE_APP_URL`.
- "Run the server locally" → see "Working locally". Default to deploying to `dev` unless the user explicitly wants a localhost loop.

## What Typebase does not include yet

Storage, mailers, realtime queries, custom domains per environment, migration files (push-only today), and oRPC plugin escape hatches are on the v0.2.0/v0.3.0 roadmap. Don't fabricate APIs for these; instead, suggest a plain TS library called from a handler (e.g., Resend in an action for email) until the official surface lands.

## Authoritative references

When something is not covered here, defer to the official Typebase docs first, then to the underlying libraries — Typebase's APIs are thin wrappers and their docs apply directly:

- Typebase (official documentation): <https://typebase.io>
- oRPC (RPC layer, client options, plugin system): <https://orpc.dev>
- Drizzle ORM (column types, query API, relations): <https://orm.drizzle.team>
- better-auth (every auth strategy, plugins, session config): <https://www.better-auth.com>
