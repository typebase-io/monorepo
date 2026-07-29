# @typebase-io/build-apps

Internal build tooling for the monorepo. Not published to npm.

## What it does

Exposes two commands:

- `build [--app <name>]` — build **one** app for distribution (ESM + CJS + type declarations) and stage it in `publish/<app>/`
- `build-library -v <version>` — assemble the unified publishable `typebase` package into `publish/library/`

### `build`

Apps are discovered from the directories inside `apps/` (everything except `build-apps`). In practice the publishable ones are `cli` and `core`. When
`--app` is omitted the command asks which app to build.

For each build it:

1. Transpiles `src/` twice with swc — ESM (`nodenext`) and CJS — into `apps/<app>/dist/esm` and `apps/<app>/dist/cjs`.
2. Emits type declarations with the TypeScript compiler into `apps/<app>/dist/types`, then rewrites the `#imports` path aliases with tsc-alias.
3. Copies `dist/`, the app's `README.md`, and the root `LICENSE` into `publish/<app>/`, alongside a `package.json` renamed to its public name
   (`@typebase-io/cli` → `typebase-io-cli`, `@typebase-io/core` → `typebase-io`).

### `build-library`

Bundles the CLI with esbuild (keeping `esbuild`, `@neondatabase/api-client`, `drizzle-kit`, `drizzle-orm`, `pg`, and `jiti` external) and assembles the
single publishable `typebase` package. The version is required and must be valid semver.

## Usage

From the monorepo root:

```bash
pnpm build-app              # pick an app to build, then stage it in publish/
pnpm build-library          # assemble the publishable package and pack it into a tarball
```

`pnpm build-app` builds a single app, not every app in the monorepo. It is named `build-app` rather than `build` so it is never confused with the
per-app `build` scripts. To build a specific app without the prompt, run that app's own script:

```bash
pnpm -C apps/cli build
pnpm -C apps/core build
```

## Development

```bash
pnpm dev        # run the entrypoint directly (node src/index.ts ...)
pnpm lint       # type-check, prettier, eslint
```
