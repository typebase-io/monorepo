import { Dot } from '#components/home/dot.tsx';
import { Pill } from '#components/home/pill.tsx';

export function WorksWith() {
  return (
    <section className="border-y border-fd-border bg-fd-muted/20 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-fd-muted-foreground">Ships with first-class guides for</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xl font-semibold text-fd-foreground/85 sm:text-2xl">
          <span>Next.js</span>
          <Dot />
          <span>SvelteKit</span>
          <Dot />
          <span>Nuxt</span>
          <Dot />
          <span>Expo</span>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-fd-muted-foreground">
          <span>Built on</span>
          <Pill>Drizzle ORM</Pill>
          <Pill>oRPC</Pill>
          <Pill>better-auth</Pill>
        </div>
      </div>
    </section>
  );
}
