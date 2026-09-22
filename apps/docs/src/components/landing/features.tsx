import { ArrowRight, ArrowUpRight, Braces, Database, FileCode2, LockKeyhole } from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    number: '01',
    icon: Database,
    title: 'A real Postgres database.',
    body: 'Define tables with Drizzle. Query them in your server functions. Your data lives in your own database.',
    file: 'db/schema.ts',
    href: '/docs/database',
  },
  {
    number: '02',
    icon: LockKeyhole,
    title: 'Login, already accounted for.',
    body: 'Email and password, social sign-in, sessions. Configure better-auth in one file and use it in your actions.',
    file: 'auth.ts',
    href: '/docs/auth',
  },
  {
    number: '03',
    icon: Braces,
    title: 'Types that go the whole way.',
    body: 'From your database to your server to your frontend. Change a return value and your editor knows about it.',
    file: 'actions/',
    href: '/docs/actions',
  },
];

export function Features() {
  return (
    <section aria-labelledby="features-heading" data-landing-section="features" className="border-b border-fd-border">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-20">
          <div>
            <h2 id="features-heading" className="text-3xl font-semibold leading-[1.1] tracking-[-0.035em] sm:text-4xl">
              Batteries included.
              <br />
              <span className="text-fd-primary">Wiring removed.</span>
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-6 text-fd-muted-foreground">
              Built on Drizzle, better-auth, and oRPC. Familiar tools, working together in one folder.
            </p>
            <Link href="/docs" className="mt-6 inline-flex items-center gap-2 text-sm text-fd-primary underline-offset-4 hover:underline">
              Meet the toolkit
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div>
            {features.map(({ icon: Icon, ...feature }) => (
              <Link
                key={feature.number}
                href={feature.href}
                className="group grid grid-cols-[auto_1fr_auto] gap-4 border-fd-border py-6 not-first:border-t first:pt-0 last:pb-0 sm:gap-6"
              >
                <Icon className="mt-1 size-5 text-fd-primary" />
                <div>
                  <h3 className="text-xl font-medium tracking-tight transition-colors group-hover:text-fd-primary sm:text-2xl">{feature.title}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-fd-muted-foreground">{feature.body}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] text-fd-primary">
                    <FileCode2 className="size-3" />
                    {feature.file}
                  </span>
                </div>
                <ArrowUpRight className="mt-2 size-4 text-fd-muted-foreground transition-colors group-hover:text-fd-primary" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
