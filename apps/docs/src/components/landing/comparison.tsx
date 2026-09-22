import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const rows = [
  {
    label: 'Backend logic',
    typebase: 'TypeScript actions',
    supabase: 'SQL functions and Edge Functions',
    convex: 'Queries, mutations, and actions',
  },
  {
    label: 'Database',
    typebase: 'Postgres',
    supabase: 'Postgres',
    convex: 'Proprietary',
  },
  {
    label: 'Type safety',
    typebase: 'End-to-end, always in sync',
    supabase: 'Generated, can drift',
    convex: 'End to end',
  },
  {
    label: 'Realtime',
    typebase: 'Streaming actions over SSE',
    supabase: 'Realtime subscriptions',
    convex: 'Reactive queries',
  },
  {
    label: 'Auth',
    typebase: 'better-auth, configured in one file',
    supabase: 'Built in, configured in the dashboard',
    convex: 'Third-party providers',
  },
  {
    label: 'Hosting',
    typebase: 'Your providers, or a generated server',
    supabase: 'Supabase Cloud or self-hosted',
    convex: 'Convex Cloud or self-hosted',
  },
];

export function Comparison() {
  return (
    <section
      id="comparison"
      aria-labelledby="comparison-heading"
      data-landing-section="comparison"
      className="scroll-mt-20 border-b border-fd-border"
    >
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
        <h2 id="comparison-heading" className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
          The DX of <span className="text-fd-primary">Convex</span>.
          <br />
          The openness of <span className="text-fd-primary">Supabase</span>.
        </h2>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-fd-muted-foreground">
          A dashboard setting never shows up in a pull request. There’s no diff to review and no commit to revert, so your repo and your backend drift
          apart. A toggle someone flips on Tuesday can break production without a line of code changing. Your agent can’t see it either; it only reads
          the repo. In Typebase your schema, auth, and permission checks are files, reviewed like the rest of your app.
        </p>
        <div className="scroll-shadows mt-8 rounded-lg border border-fd-primary/25">
          <div tabIndex={0} role="region" aria-label="Backend comparison, scroll horizontally on smaller screens" className="scroll-shadows-scroller">
            <table className="w-full min-w-170 border-collapse text-left text-sm leading-6">
              <caption className="sr-only">
                Typebase, Supabase, and Convex: backend logic, database, type safety, realtime, auth, hosting, and application dependencies
              </caption>
              <thead>
                <tr className="border-b border-fd-primary/25">
                  <th scope="col" className="w-1/5 p-5 font-medium text-fd-muted-foreground">
                    Your choices
                  </th>
                  <th scope="col" className="w-[28%] bg-fd-primary/10 p-5 text-lg font-semibold text-fd-primary">
                    Typebase
                  </th>
                  <th scope="col" className="w-[26%] p-5 text-lg font-semibold">
                    Supabase
                  </th>
                  <th scope="col" className="w-[26%] p-5 text-lg font-semibold">
                    Convex
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="not-last:border-b border-fd-border">
                    <th scope="row" className="p-5 align-top font-medium">
                      {row.label}
                    </th>
                    <td className="bg-fd-primary/5 p-5 align-top text-fd-secondary-foreground">{row.typebase}</td>
                    <td className="p-5 align-top text-fd-muted-foreground">{row.supabase}</td>
                    <td className="p-5 align-top text-fd-muted-foreground">{row.convex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Link
          href="/docs/comparison"
          className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-fd-primary underline-offset-4 hover:underline"
        >
          Read the full comparison <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
