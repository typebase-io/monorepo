import { match } from 'ts-pattern';

import { type ServerProvider } from '#helpers/constants.ts';
import { streamCloudflareLogs } from '#helpers/logs/cloudflare/index.ts';
import { streamDenoLogs } from '#helpers/logs/deno/index.ts';
import { streamVercelLogs } from '#helpers/logs/vercel/index.ts';
import { runUntilStopped } from '#helpers/shared/run-until-stopped.ts';

export const streamLogs = async ({ target, provider }: { target: 'dev' | 'prod'; provider: ServerProvider }): Promise<void> => {
  await runUntilStopped(async (signal) => {
    await match(provider)
      .with('vercel', () => streamVercelLogs({ target, signal }))
      .with('deno', () => streamDenoLogs({ target, signal }))
      .with('cloudflare', () => streamCloudflareLogs({ target, signal }))
      .exhaustive();
  });
};
