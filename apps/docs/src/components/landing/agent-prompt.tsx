'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ScrollTo } from '#components/landing/scroll-to.tsx';
import { copyText } from '#lib/copy-text.ts';
import { trackLanding } from '#lib/track-landing.ts';

const agentPrompt = `Add a Typebase backend to this project.

Read the project first. Install the Typebase skill with:
npx skills add typebase-io/monorepo
Read the skill before writing code.

Ask what I’m building, what data I need, and whether users should sign in. Then install Typebase, scaffold the backend, and connect it to my existing frontend. Follow the skill and keep the project’s conventions.

For private data, verify the session and check ownership in server actions. Validate inputs and accept only the fields each action needs. Run the project’s type checks and test the permission checks.

Summarize your changes and stop before deploying. I’ll handle the first deployment and provider login.`;

export function CopyAgentPrompt({ placement }: { placement: 'agent-section' | 'footer-cta' }) {
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
      await copyText(agentPrompt);

      setStatus('copied');
      trackLanding('landing_copy', { command: 'agent_prompt', placement });

      timeout.current = setTimeout(() => {
        setStatus('idle');
      }, 2500);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="relative inline-flex w-full flex-col items-start sm:w-auto">
      <button
        type="button"
        onClick={() => void copy()}
        className={`inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-md border px-4 py-3 text-sm font-semibold transition-colors ${placement === 'agent-section' ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground hover:bg-fd-secondary-foreground' : 'border-fd-primary/40 bg-fd-primary/5 text-fd-primary hover:bg-fd-primary/15'}`}
      >
        {status === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
        {status === 'copied' ? 'Prompt copied' : 'Copy prompt for your AI'}
      </button>

      <span role="status" className="sr-only">
        {status === 'copied'
          ? 'Copied. Paste the prompt into your coding agent.'
          : status === 'error'
            ? 'Clipboard unavailable. You can select and copy the prompt in the AI section.'
            : ''}
      </span>

      {status === 'error' && (
        <ScrollTo targetId="agent-prompt" className="mt-2 max-w-64 cursor-pointer text-left text-xs text-fd-primary underline underline-offset-4">
          Clipboard unavailable. Select and copy the prompt.
        </ScrollTo>
      )}
    </div>
  );
}

export function AgentPrompt() {
  return (
    <div id="agent-prompt" className="min-w-0 scroll-mt-20 overflow-hidden rounded-lg border border-fd-primary/25 bg-fd-muted/30">
      <div className="flex items-center justify-between gap-4 border-b border-fd-border px-5 py-4 sm:px-6">
        <span className="font-mono text-xs text-fd-primary">Your next conversation</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-fd-muted-foreground">Ready to paste</span>
      </div>
      <pre
        tabIndex={0}
        aria-label="Typebase setup prompt"
        className="max-h-72 overflow-y-auto whitespace-pre-wrap wrap-break-word px-5 py-5 font-mono text-xs leading-6 text-fd-secondary-foreground sm:px-6"
      >
        {agentPrompt}
      </pre>
      <div className="border-t border-fd-border bg-fd-background/50 px-5 py-5 sm:px-6">
        <CopyAgentPrompt placement="agent-section" />
        <p className="mt-3 text-xs leading-5 text-fd-muted-foreground">Paste into Claude Code, Cursor, Codex, or your preferred coding agent.</p>
      </div>
    </div>
  );
}
