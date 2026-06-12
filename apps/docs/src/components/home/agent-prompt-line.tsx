'use client';

import { useState } from 'react';

const agentPrompt = `Add Typebase to this project.

1. npm i typebase-io && npm i -D typebase-io-cli
2. npx skills add typebase-io/monorepo (installs the Typebase agent skill. read it before writing any code)
3. npx typebase-io-cli init
4. Ask me if I want auth. If I do, set it up following the skill.
5. Ask me what tables and actions I need, then define them in typebase/db/schema.ts and typebase/actions/.
6. Stop before deploying. The first deploy asks me to log in, so I'll run \`npx typebase-io-cli deploy dev\` myself.`;

export function AgentPromptLine() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(agentPrompt).then(() => {
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-12 cursor-pointer font-mono text-xs italic text-fd-muted-foreground transition hover:text-fd-foreground"
    >
      {copied ? (
        '// copied. now go paste it.'
      ) : (
        <>
          {'// or skip the reading entirely. send '}
          <span className="underline decoration-fd-primary underline-offset-4">this</span>
          {' to your agent'}
        </>
      )}
    </button>
  );
}
