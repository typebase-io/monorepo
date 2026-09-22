import { ArrowDown } from 'lucide-react';

import { CodeTokens } from '#components/landing/highlighted-code.tsx';
import { highlightCode } from '#lib/highlight-code.ts';

const serverCode = `import { action } from '../../_generated/server';

export const getMany = action
  .handler(async ({ db }) => {
    return db.query.todos.findMany();
  });`;

const frontendCode = `import { client } from '@/lib/typebase/client';

export default async function Page() {
  const todos = await client.queries.todos.getMany();
  // ^? { id: number; value: string; completed: boolean }[]

  return todos.map((t) => (
    <li key={t.id}>{t.value}</li>
  ));
}`;

const flow = 'transition-colors group-hover/type-flow:bg-fd-primary/15 group-focus-within/type-flow:bg-fd-primary/15 motion-reduce:transition-none';

export async function HeroCode() {
  const [serverLines, frontendLines] = await Promise.all([highlightCode(serverCode), highlightCode(frontendCode, 'tsx')]);

  return (
    <div className="group/type-flow min-w-0 self-center rounded-lg border border-fd-primary/30 bg-fd-muted/50" data-hero-code>
      <div className="flex items-center justify-between gap-3 border-b border-fd-border px-4 py-3 sm:px-5">
        <span className="font-mono text-xs text-fd-primary">One function. Both sides.</span>
        <span className="font-mono text-[10px] text-fd-muted-foreground">01 → 02</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="mb-3 font-mono text-[10px] text-fd-muted-foreground">SERVER · typebase/actions/queries/todos.ts</p>
        <pre tabIndex={0} aria-label="Server function example" className="overflow-x-auto font-mono text-[11px] leading-6 sm:text-xs">
          <code>
            {serverLines.map((line, index) => (
              <span key={index} className={`block min-h-6 ${index + 1 === 5 ? flow : ''}`}>
                <CodeTokens line={line} />
              </span>
            ))}
          </code>
        </pre>
      </div>
      <div className="flex items-center gap-3 border-y border-fd-primary/20 bg-fd-primary/5 px-4 py-2 text-xs text-fd-primary sm:px-5">
        <ArrowDown aria-hidden className="size-3.5" /> Types travel with the call. Over HTTP.
      </div>
      <div className="p-4 sm:p-5">
        <p className="mb-3 font-mono text-[10px] text-fd-muted-foreground">FRONTEND · src/app/page.tsx</p>
        <pre tabIndex={0} aria-label="Typed frontend call example" className="overflow-x-auto font-mono text-[11px] leading-6 sm:text-xs">
          <code>
            {frontendLines.map((line, index) => (
              <span key={index} className={`block min-h-6 ${index + 1 === 5 ? flow : ''}`}>
                <CodeTokens line={line} />
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
