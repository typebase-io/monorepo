import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const rows = [
  {
    label: 'Backend logic',
    typebase: 'TypeScript functions',
    supabase: 'SQL + RLS policies',
    convex: 'TypeScript functions',
  },
  {
    label: 'Database',
    typebase: 'Standard Postgres',
    supabase: 'Postgres',
    convex: 'Proprietary',
  },
  {
    label: 'Type safety',
    typebase: 'End-to-end, always in sync',
    supabase: 'Generated, can drift',
    convex: 'End-to-end',
  },
  {
    label: 'Auth',
    typebase: 'better-auth, in one file',
    supabase: 'Built-in, dashboard config',
    convex: 'Third-party providers',
  },
  {
    label: 'Infrastructure',
    typebase: 'Your cloud: Vercel, Cloudflare, Deno',
    supabase: 'Supabase-hosted',
    convex: 'Convex-hosted',
  },
  {
    label: 'Vendor lock-in',
    typebase: 'None, eject anytime',
    supabase: 'Medium',
    convex: 'High',
  },
];

export function Comparison() {
  return (
    <section className="border-b border-fd-border bg-fd-muted/20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
            The DX of Convex. <span className="sm:whitespace-nowrap">The openness of Supabase.</span>
          </h2>
          <p className="mt-4 text-fd-muted-foreground">
            Typebase exists because we wanted both and couldn&rsquo;t find it: backend functions that live in your code, backed by a database you
            actually own.
          </p>
        </div>

        <div className="scroll-shadows mt-14 rounded-xl border border-fd-border bg-fd-card">
          <div className="scroll-shadows-scroller">
            <table className="w-full min-w-176 border-collapse text-sm">
              <thead>
                <tr className="border-b border-fd-border text-left">
                  <th className="px-5 py-4" />
                  <th className="bg-fd-primary/10 px-5 py-4 font-semibold text-fd-primary">Typebase</th>
                  <th className="px-5 py-4 font-semibold text-fd-foreground/80">Supabase</th>
                  <th className="px-5 py-4 font-semibold text-fd-foreground/80">Convex</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fd-border">
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="whitespace-nowrap px-5 py-3.5 text-left font-medium text-fd-muted-foreground">
                      {row.label}
                    </th>
                    <td className="bg-fd-primary/10 px-5 py-3.5 font-medium text-fd-foreground">{row.typebase}</td>
                    <td className="px-5 py-3.5 text-fd-muted-foreground">{row.supabase}</td>
                    <td className="px-5 py-3.5 text-fd-muted-foreground">{row.convex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-fd-muted-foreground">
          Realtime and storage aren&rsquo;t there yet; they&rsquo;re next on the{' '}
          <Link href="/docs/roadmap" className="text-fd-primary underline-offset-4 hover:underline">
            roadmap
          </Link>
          .{' '}
          <Link href="/docs/comparison" className="inline-flex items-center gap-1 text-fd-primary underline-offset-4 hover:underline">
            Read the full comparison
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </p>
      </div>
    </section>
  );
}
