import { FileCode2 } from 'lucide-react';

import { HighlightedCode } from '#components/landing/highlighted-code.tsx';

const code = `import { authedAction } from '../custom-actions';

export const getMine = authedAction
  .handler(async ({ db, user }) => {
    return db.query.todos.findMany({
      where: { userId: user.id },
    });
  });`;

export function AuthorizationExample() {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-fd-primary/25 bg-fd-muted/30">
      <div className="flex items-center justify-between gap-3 border-b border-fd-border px-4 py-3 sm:px-5">
        <span className="flex min-w-0 items-center gap-2">
          <FileCode2 aria-hidden className="size-3.5 shrink-0 text-fd-primary" />
          <span className="truncate font-mono text-[10px] text-fd-muted-foreground sm:text-xs">typebase/actions/queries/todos.ts</span>
        </span>
        <span className="shrink-0 rounded bg-fd-primary/15 px-2 py-0.5 font-mono text-[10px] tracking-wider text-fd-primary uppercase">
          TypeScript
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-fd-border px-4 py-3 text-xs text-fd-muted-foreground sm:px-5">
        <span className="truncate">
          The same rule, <span className="text-fd-foreground">next to the query it protects</span>
        </span>
      </div>

      <div className="flex-1">
        <HighlightedCode code={code} highlight={6} />
      </div>

      <p className="border-t border-fd-border px-4 py-4 text-xs leading-5 text-fd-muted-foreground sm:px-5">
        <span className="font-medium text-fd-primary">authedAction</span> checks the session, and the highlighted line narrows the rows to that user.
        Change the shape and the type checker tells you.
      </p>
    </div>
  );
}
