import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { AuthorizationExample } from '#components/landing/authorization-example.tsx';
import { BrandTitle } from '#components/landing/brand-title.tsx';
import { RlsPolicies } from '#components/landing/rls-policies.tsx';
import { SectionLabel } from '#components/landing/section-label.tsx';

export function Authorization() {
  return (
    <section aria-labelledby="authorization-heading" data-landing-section="authorization" className="border-b border-fd-border">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
        <SectionLabel number="04">Signed in isn’t the whole rule</SectionLabel>

        <h2 id="authorization-heading" className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
          <span className="text-fd-muted-foreground line-through decoration-fd-primary decoration-wavy decoration-[3px]">RLS policies.</span>
          <br />
          <span className="text-fd-primary">Plain TypeScript checks.</span>
        </h2>

        <p className="mt-5 max-w-2xl text-sm leading-6 text-fd-muted-foreground">
          Alice should see Alice’s todos. Signed in is not the same as owner — and that gap is easy to miss in a policy, because nothing in your
          editor is checking it. Here is the same rule, written twice.
        </p>

        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col">
            <BrandTitle>
              <span className="text-[#3ecf8e]">Other providers</span>
            </BrandTitle>
            <div className="mt-3 flex-1">
              <RlsPolicies />
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <BrandTitle logo="/logo.svg">
              <span className="text-fd-foreground">
                Typebase<span className="text-fd-primary">.</span>
              </span>
            </BrandTitle>
            <div className="mt-3 flex-1">
              <AuthorizationExample />
            </div>
          </div>
        </div>

        <Link
          href="/docs/actions/middleware"
          className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-fd-primary underline-offset-4 hover:underline"
        >
          See authorization in code <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
