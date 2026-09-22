import type { CodeLine } from '#lib/highlight-code.ts';

const highlighted = 'border-l-2 border-fd-primary bg-fd-primary/10 -mx-4 pr-4 pl-[calc(1rem-2px)] sm:-mx-6 sm:pr-6 sm:pl-[calc(1.5rem-2px)]';

export function CodeTokens({ line }: { line: CodeLine }) {
  return line.map((token, index) => (
    <span key={index} style={{ color: token.color }} className={token.italic ? 'italic' : undefined}>
      {token.text}
    </span>
  ));
}

export function HighlightedCode({ lines, highlight }: { lines: CodeLine[]; highlight?: number }) {
  return (
    <pre
      className="overflow-x-auto px-4 py-6 font-mono text-[11px] leading-7 sm:px-6 sm:text-xs lg:text-[13px]"
      tabIndex={0}
      aria-label="TypeScript example"
    >
      <code>
        {lines.map((line, index) => (
          <span key={index} className={`block min-h-7 ${highlight === index + 1 ? highlighted : ''}`}>
            <span aria-hidden="true" className="mr-5 inline-block w-4 select-none text-right text-fd-muted-foreground/70">
              {index + 1}
            </span>
            <CodeTokens line={line} />
          </span>
        ))}
      </code>
    </pre>
  );
}
