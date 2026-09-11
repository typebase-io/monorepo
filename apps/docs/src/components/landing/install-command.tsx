'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { copyText } from '#lib/copy-text.ts';
import { trackLanding } from '#lib/track-landing.ts';

const command = 'npm i typebase-io && npm i -D typebase-io-cli';

export function InstallCommand() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    []
  );

  async function copy() {
    if (timeout.current) clearTimeout(timeout.current);

    try {
      await copyText(command);
      setStatus('copied');
      trackLanding('landing_copy', { command: 'install' });

      timeout.current = setTimeout(() => {
        setStatus('idle');
      }, 2500);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="mt-6 max-w-xl">
      <div className="flex items-center gap-4 rounded-md border border-fd-primary/25 bg-fd-background px-4 py-3">
        <span aria-hidden="true" className="font-mono text-fd-primary">
          $
        </span>
        <code className="min-w-0 flex-1 wrap-break-word font-mono text-xs leading-6 text-fd-foreground sm:text-sm">{command}</code>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={status === 'copied' ? 'Copied install command' : 'Copy install command'}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded border border-fd-border text-fd-primary transition-colors hover:bg-fd-primary/10"
        >
          {status === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p role="status" className="mt-2 min-h-5 text-xs text-fd-muted-foreground">
        {status === 'copied'
          ? 'Copied. Your terminal is next.'
          : status === 'error'
            ? 'Couldn’t access your clipboard. Select and copy the command above.'
            : 'Install in your existing JavaScript or TypeScript project.'}
      </p>
    </div>
  );
}
