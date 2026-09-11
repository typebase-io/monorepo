import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const frameworks = [
  { name: 'Next.js', href: '/docs/integrations/nextjs' },
  { name: 'SvelteKit', href: '/docs/integrations/sveltekit' },
  { name: 'Nuxt', href: '/docs/integrations/nuxt' },
  { name: 'Expo', href: '/docs/integrations/expo' },
];

export function Frameworks() {
  return (
    <section aria-labelledby="framework-heading" data-landing-section="frameworks" className="border-b border-fd-border bg-fd-muted/25">
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 sm:px-8 lg:grid-cols-[1fr_3fr] lg:items-center lg:gap-8 lg:px-12">
        <div>
          <h2 id="framework-heading" className="text-sm font-medium">
            Keep the frontend you like.
          </h2>
          <p className="mt-1 text-xs text-fd-muted-foreground">Pick your framework. There’s a guide.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {frameworks.map((framework) => (
            <Link
              key={framework.name}
              href={framework.href}
              className="group flex items-center justify-between gap-2 rounded border border-fd-border px-3 py-3 transition-colors hover:border-fd-primary/50 hover:bg-fd-primary/5 sm:px-4"
            >
              <span className="text-base font-semibold tracking-tight sm:text-lg">{framework.name}</span>
              <ArrowUpRight className="size-3.5 text-fd-muted-foreground transition-colors group-hover:text-fd-primary" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
