'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function CopyCommand({ command, children }: { command: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }

  return (
    <div className="mx-auto mt-8 flex w-fit max-w-full items-center gap-3 rounded-lg border border-fd-border bg-fd-card py-2 pl-4 pr-2 text-left font-mono text-sm text-fd-foreground/90">
      <code className="min-w-0 overflow-x-auto whitespace-nowrap">{children}</code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="shrink-0 rounded-md p-2 text-fd-muted-foreground transition hover:bg-fd-muted/40 hover:text-fd-foreground"
      >
        <span className="relative block h-4 w-4 cursor-pointer">
          <Copy className={`absolute inset-0 h-4 w-4 transition-all duration-200 ${copied ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`} />

          <Check
            className={`absolute inset-0 h-4 w-4 text-emerald-400 transition-all duration-200 ${copied ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
          />
        </span>
      </button>
    </div>
  );
}
