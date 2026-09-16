# @typebase-io/tools

Internal tooling for the monorepo. Not published to npm.

## What it does

Exposes three commands:

- `build-app [app]` — build **one** app for distribution (ESM + CJS + type declarations) and stage it in `publish/<app>/`
- `build-library -v <version>` — assemble the unified publishable `typebase` package into `publish/library/`
- `compare-docs [branch]` — screenshot `apps/docs` on two Git revisions and diff every page, hover state and menu

### `build-app`

Apps are discovered from the directories inside `apps/` (everything except `tools`). In practice the publishable ones are `cli` and `core`. The app
is passed as a positional argument (`build-app core`); when it is omitted the command asks which app to build.

For each build it:

1. Transpiles `src/` twice with swc — ESM (`nodenext`) and CJS — into `apps/<app>/dist/esm` and `apps/<app>/dist/cjs`.
2. Emits type declarations with the TypeScript compiler into `apps/<app>/dist/types`, then rewrites the `#imports` path aliases with tsc-alias.
3. Copies `dist/`, the app's `README.md`, and the root `LICENSE` into `publish/<app>/`, alongside a `package.json` renamed to its public name
   (`@typebase-io/cli` → `typebase-io-cli`, `@typebase-io/core` → `typebase-io`).

### `build-library`

Bundles the CLI with esbuild (keeping `esbuild`, `@neondatabase/api-client`, `drizzle-kit`, `drizzle-orm`, `pg`, and `jiti` external) and assembles the
single publishable `typebase` package. The version is required and must be valid semver.

### `compare-docs`

Visual regression check for `apps/docs`, written for dependency upgrades: it proves what a branch changed on screen, rather than asserting nothing
changed.

It resolves `main` and the candidate branch to exact commits, creates a **detached worktree at the candidate commit**, switches this checkout to `main`,
then runs `pnpm install --frozen-lockfile`, the docs lint and a production build in both directories and starts each build on its own free localhost
port. Tracked uncommitted changes abort the run; untracked files are left alone. It never stashes, resets, or force-removes anything.

With both servers up it reads each sitemap, captures the union of their routes on both revisions and, for every route:

1. Takes a full-page screenshot in light and dark at desktop (1440 × 1000), mobile touch (390 × 844) and mobile width with a mouse, scrolling first so
   lazy content loads.
2. Hovers every visible, enabled link and button in each mouse profile — including controls only reachable inside a menu — and captures each hover.
   A control that appears on many routes (nav, sidebar, footer) is hovered once per theme and profile, on the first route it was seen on, rather than once per route.
3. Clicks or taps disclosures, accordions, tabs and search triggers, captures the resulting state, and recurses into nested controls up to
   `--max-depth`.
4. Records console exceptions, failed local requests, broken images, horizontal overflow and WCAG A/AA findings from axe on default page states.

Everything is then diffed with pixelmatch and written to `.artifacts/compare-docs/<run>/` as PNGs, pixel diffs, inventories, build logs and a
self-contained `index.html` report with filters, side-by-side panes, an overlay slider and the diff images.

One change to shared furniture — sidebar spacing, a nav hover colour — differs on every page that renders it, which can bury the rest of the run in
repeats. So each changed capture also records _where_ it changed: the bounding box of the differing pixels, and a signature built from the 32px columns
and the eighths of the page height that contain changes. The report's **Group repeats** toggle (on by default) collapses captures that share a signature
into one entry marked `×N`, listing every affected route underneath. A page that has the shared change _and_ something of its own gets a different
signature, so it stays a separate entry rather than disappearing into the group — untick the toggle to see every capture individually. Servers are stopped and worktrees created by
the run are removed with an ordinary `git worktree remove`; a worktree Git refuses to remove is kept.

Exit codes: `0` no differences detected, `1` differences/new findings/failed checks, `2` incomplete run or incomplete capture coverage.

**A pixel difference is a change to review, not proof of a regression**, and a clean run does not prove every interaction works. Touch profiles have no
hover state: `mobile-touch` tests the touch layout, and `mobile-hover` is a mouse at mobile width, labelled separately. Hover deduplication means a
control whose hover renders differently depending on the route — a nav item styled as the current page, say — is only captured on its owning route; use
`--no-hover-dedup` when that is what you are checking. Menus are discovered through
`aria-expanded`, `aria-haspopup`, tabs, controlled toggles, native `summary` and search-button labels — unmarked custom menus cannot be inferred. Both
revisions share a browser, clock, locale, timezone and device scale, animations are disabled and analytics requests are suppressed. Still worth checking
by hand after an upgrade: keyboard navigation and focus handling, search with real queries, clipboard actions, `/api/search`, `/llms.txt`, OG images,
and at least one WebKit/real-device pass.

## Usage

From the monorepo root:

```bash
pnpm build-app              # pick an app to build, then stage it in publish/
pnpm build-library          # assemble the publishable package and pack it into a tarball
pnpm compare-docs <branch>  # compare apps/docs on <branch> against main
```

`compare-docs` needs a Chromium build once:

```bash
pnpm -C apps/tools exec playwright install chromium
```

Capture runs in two passes: the first walks every route and menu state and takes the page screenshots, and the second hovers controls. Splitting them
is what makes hover deduplication possible — after the first pass the tool knows every route a control appears on, so it can pick one deterministically
instead of depending on which worker happened to get there first. `--no-hover-dedup` hovers every control on every route, as it did before.

On a fixture with 8 routes this cut a run from 288 screenshots to 106; on a site whose nav repeats across 37 routes the saving is far larger. Both modes
detected exactly the same changes on the same routes in testing — dedup reports each one once instead of once per route.

Routes are captured by `--concurrency` workers at a time (4 by default), each with its own browser context. Capture is mostly waiting on page loads, so
raising it helps: on a 10-core machine a 144-capture run took 63s at `--concurrency 1`, 23s at 4 and 17s at 8. Screenshots are byte-identical at every
concurrency level, so changing it does not change the comparison — lower it only if a loaded machine starts producing capture failures.

Start with a subset before an exhaustive run — all pages and all controls can produce thousands of images:

```bash
pnpm compare-docs feat-update-docs-deps --pages /,/docs,/docs/getting-started --themes light
```

`--keep-checkout` compares in two worktrees and leaves this checkout (and its `node_modules`) untouched, which is also how you run the tool from a
branch that has not been merged into `main` yet. To compare servers you already started, skipping all Git, install, lint and build work:

```bash
pnpm compare-docs --base-url http://127.0.0.1:3000 --candidate-url http://127.0.0.1:3001 --pages /,/docs
```

Open the printed `index.html` directly, or serve it with `pnpm compare-docs --serve .artifacts/compare-docs/<run>`. `--help` lists every option.

A finished run keeps every screenshot, so the diff can be redone without capturing anything again:

```bash
pnpm compare-docs --recompare .artifacts/compare-docs/<run> --threshold 0.25
```

That re-diffs the stored captures in place and rewrites `diff/`, `report.json` and `index.html`, carrying the original run's branches, commits, routes and
build checks into the new report. Nothing is deleted until the comparison has finished: diff images the new comparison no longer produces are removed at
the end, so an interrupted recompare leaves the existing report intact rather than stripping the images it points at. Use it to retune `--threshold` on a long run, or to rebuild a report after the tool's diffing or reporting changes. It
refuses to run alongside a branch or `--base-url`, and stops if any screenshot named in the inventory is missing from disk. An interrupted run can be
recompared too — it still exits `2`, because a partial capture stays partial.

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
