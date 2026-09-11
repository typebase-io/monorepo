import { ArrowDown } from 'lucide-react';

export function HeroCode() {
  return (
    <div className="group/type-flow min-w-0 self-center rounded-lg border border-fd-primary/30 bg-fd-muted/50" data-hero-code>
      <div className="flex items-center justify-between gap-3 border-b border-fd-border px-4 py-3 sm:px-5">
        <span className="font-mono text-xs text-fd-primary">One function. Both sides.</span>
        <span className="font-mono text-[10px] text-fd-muted-foreground">01 → 02</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="mb-3 font-mono text-[10px] text-fd-muted-foreground">SERVER · typebase/actions/queries/todos.ts</p>
        <pre tabIndex={0} aria-label="Server function example" className="overflow-x-auto font-mono text-[11px] leading-6 sm:text-xs">
          <code className="text-[#cfd6e6]">
            <span className="block">
              <span className="text-[#7aa2e8]">import</span>
              {' { action } '}
              <span className="text-[#7aa2e8]">from</span> <span className="text-[#7fbf7b]">{"'../../_generated/server'"}</span>;
            </span>
            {'\n'}
            <span className="block">
              <span className="text-[#7aa2e8]">export const</span> <span className="text-[#e0b35a]">getMany</span>
              {' = action'}
            </span>
            <span className="block">
              {'  .'}
              <span className="text-[#e0b35a]">handler</span>(<span className="text-[#7aa2e8]">async</span>
              {' ({ db }) => {'}
            </span>
            <span className="block transition-colors group-hover/type-flow:bg-fd-primary/15 group-focus-within/type-flow:bg-fd-primary/15 motion-reduce:transition-none">
              {'    '}
              <span className="text-[#7aa2e8]">return</span>
              {' db.query.todos.'}
              <span className="text-[#e0b35a]">findMany</span>();
            </span>
            <span className="block">{'  });'}</span>
          </code>
        </pre>
      </div>
      <div className="flex items-center gap-3 border-y border-fd-primary/20 bg-fd-primary/5 px-4 py-2 text-xs text-fd-primary sm:px-5">
        <ArrowDown aria-hidden className="size-3.5" /> Types travel with the call. Over HTTP.
      </div>
      <div className="p-4 sm:p-5">
        <p className="mb-3 font-mono text-[10px] text-fd-muted-foreground">FRONTEND · src/app/page.tsx</p>
        <pre tabIndex={0} aria-label="Typed frontend call example" className="overflow-x-auto font-mono text-[11px] leading-6 sm:text-xs">
          <code className="text-[#cfd6e6]">
            <span className="block">
              <span className="text-[#7aa2e8]">import</span>
              {' { client } '}
              <span className="text-[#7aa2e8]">from</span> <span className="text-[#7fbf7b]">{"'@/lib/typebase/client'"}</span>;
            </span>
            {'\n'}
            <span className="block">
              <span className="text-[#7aa2e8]">export default async function</span> <span className="text-[#e0b35a]">Page</span>
              {'() {'}
            </span>
            <span className="block">
              {'  '}
              <span className="text-[#7aa2e8]">const</span>
              {' todos = '}
              <span className="text-[#7aa2e8]">await</span>
              {' client.queries.todos.'}
              <span className="text-[#e0b35a]">getMany</span>();
            </span>
            <span className="block text-fd-secondary-foreground italic transition-colors group-hover/type-flow:bg-fd-primary/15 group-focus-within/type-flow:bg-fd-primary/15 motion-reduce:transition-none">
              {'  // ^? { id: number; value: string; completed: boolean }[]'}
            </span>
            {'\n'}
            <span className="block">
              {'  '}
              <span className="text-[#7aa2e8]">return</span>
              {' todos.'}
              <span className="text-[#e0b35a]">map</span>
              {'((t) => ('}
            </span>
            <span className="block">
              {'    <'}
              <span className="text-[#c78bd9]">li</span>
              {' key={t.id}>{t.value}</'}
              <span className="text-[#c78bd9]">li</span>
              {'>'}
            </span>
            <span className="block">{'  ));'}</span>
            <span className="block">{'}'}</span>
          </code>
        </pre>
      </div>
    </div>
  );
}
