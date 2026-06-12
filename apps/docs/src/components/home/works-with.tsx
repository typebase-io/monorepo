import { Dot } from '#components/home/dot.tsx';
import { Pill } from '#components/home/pill.tsx';

export function WorksWith() {
  return (
    <section className="border-y border-fd-border bg-fd-muted/20 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-fd-muted-foreground">Ships with first-class guides for</p>
        <div className="mt-5 flex flex-col items-center gap-y-1 text-xl font-semibold text-fd-foreground/85 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-10 sm:gap-y-3 sm:text-2xl">
          <div className="flex items-center gap-x-5 sm:contents">
            <span>Next.js</span>
            <Dot />
            <span>SvelteKit</span>
          </div>
          <span className="hidden text-fd-muted-foreground/60 sm:inline">·</span>
          <div className="flex items-center gap-x-5 sm:contents">
            <span>Nuxt</span>
            <Dot />
            <span>Expo</span>
          </div>
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-fd-muted-foreground">
          Idiomatic clients for each one: Server Components, SvelteKit load functions, Nuxt plugins, Expo SecureStore.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-fd-muted-foreground">
          <span>Built on</span>
          <Pill href="https://orm.drizzle.team">Drizzle ORM</Pill>
          <Pill href="https://orpc.dev">oRPC</Pill>
          <Pill href="https://www.better-auth.com">better-auth</Pill>
        </div>
      </div>
    </section>
  );
}
