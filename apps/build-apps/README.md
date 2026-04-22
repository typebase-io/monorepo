# @typebase-io/build-apps

Internal build tooling shared by `@typebase-io/cli` and `@typebase-io/core`. Not published to npm.

## What it does

Exposes two commands:

- `build --app <cli|core>` — build a single app for distribution (ESM + CJS + type declarations) using swc, tsc-alias, and esbuild
- `build-library -v <version>` — assemble the unified publishable `typebase` package into `./publish/library` and pack it into a tarball

From the monorepo root:

```bash
pnpm build                  # build cli and core
pnpm build-library          # assemble the publishable package and pack it
```

## Development

```bash
pnpm dev        # run the entrypoint directly (node src/index.ts ...)
pnpm lint       # type-check, prettier, eslint
```
