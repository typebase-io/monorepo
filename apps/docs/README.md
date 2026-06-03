# @typebase-io/docs

The Typebase documentation website, deployed at [typebase.io](https://typebase.io).

Built with [Next.js](https://nextjs.org) and [Fumadocs](https://fumadocs.dev). All content lives in `content/docs/` as MDX.

## Development

```bash
pnpm dev        # start the dev server at http://localhost:3000
pnpm build      # build for production
pnpm start      # run the production build
pnpm lint       # mdx build, type-check, prettier, eslint
```

## Structure

- `content/docs/` - all MDX documentation pages
- `src/app/(home)/` - the landing page
- `src/app/docs/` - the docs viewer routes
- `src/app/og/` - OpenGraph image generation
- `src/components/` - shared UI (home sections, AI search, etc.)
- `src/lib/` - helpers (content source adapter, shared layout options)
- `source.config.ts` - Fumadocs MDX config (frontmatter schema, etc.)
