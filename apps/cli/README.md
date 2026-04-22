# @typebase-io/cli

> The CLI for [Typebase](https://typebase.io) — scaffold, type, push, and deploy a typed backend from a single `typebase/` folder.

**[Documentation](https://typebase.io/docs) · [CLI reference](https://typebase.io/docs/cli) · [Getting started](https://typebase.io/docs/getting-started)**

## One tool for the whole backend lifecycle

Most stacks need a dozen tools: a schema generator, a migration runner, a codegen step, a build tool, a deploy CLI, an env sync script. Typebase replaces all of them with one CLI that understands your project end-to-end.

```bash
npx typebase-io-cli init          # scaffold the typebase/ folder
npx typebase-io-cli codegen       # regenerate types from schema, auth, and actions
npx typebase-io-cli db dev push   # push schema to a provisioned Neon dev branch
npx typebase-io-cli deploy dev    # build and deploy to Vercel, Cloudflare, or Deno
```

That's the whole loop. No migration history to manage, no OpenAPI spec to publish, no CI pipeline to glue together. Edit your TypeScript, run the CLI, ship.

## Install

```bash
npm install -D typebase-io-cli
```

Pair it with the runtime library:

```bash
npm install typebase-io
```

Then add a script so your team runs the same version:

```json
{
  "scripts": {
    "typebase": "typebase-io-cli"
  }
}
```

## Commands

| Command                              | What it does                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `typebase-io-cli init`               | Scaffold a `typebase/` directory with example schema, actions, and (optional) auth |
| `typebase-io-cli codegen`            | Regenerate TypeScript types from your schema, auth config, and actions             |
| `typebase-io-cli auth generate`      | Append better-auth tables to `db/schema.ts` and register them in `db/relations.ts` |
| `typebase-io-cli db {dev,prod} push` | Push schema changes to your Neon Postgres database                                 |
| `typebase-io-cli deploy {dev,prod}`  | Build and deploy the server to Vercel, Cloudflare Workers, or Deno Deploy          |
| `typebase-io-cli env {dev,prod}`     | Manage environment variables on your deploy provider                               |

Full reference: **[typebase.io/docs/cli](https://typebase.io/docs/cli)**.

## Works with

- **Frontend frameworks:** Next.js, SvelteKit, Nuxt, Expo (and any other JS/TS project)
- **Deploy targets:** [Vercel](https://vercel.com), [Cloudflare Workers](https://workers.cloudflare.com), [Deno Deploy](https://deno.com/deploy)
- **Database:** managed Postgres via [Neon](https://neon.tech) (separate `dev` and `prod` branches provisioned automatically)
- **Runtime library:** [`typebase-io`](https://www.npmjs.com/package/typebase-io)

## Why a CLI instead of a framework plugin?

Because your backend isn't tied to one frontend. The CLI owns the `typebase/` folder; your Next.js / SvelteKit / Nuxt / Expo app just calls the generated client. Swap the frontend, keep the backend. Or deploy the same backend to three clouds — same command, same source.

## License

[MIT](https://github.com/typebase-io/monorepo/blob/main/LICENSE)
