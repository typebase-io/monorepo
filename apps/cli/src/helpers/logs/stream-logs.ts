import { match } from 'ts-pattern';

import { type ServerProvider } from '#helpers/constants.ts';
import { streamCloudflareLogs } from '#helpers/logs/cloudflare/index.ts';
import { streamDenoLogs } from '#helpers/logs/deno/index.ts';
import { streamVercelLogs } from '#helpers/logs/vercel/index.ts';

export const streamLogs = async ({ target, provider }: { target: 'dev' | 'prod'; provider: ServerProvider }): Promise<void> => {
  const controller = new AbortController();
  const stdin = process.stdin;

  const onKeyPress = (data: Buffer): void => {
    const key = data.toString();

    if (key === 'x' || key === 'X' || key === '\u0003') {
      controller.abort();
    }
  };

  const onSigint = (): void => {
    controller.abort();
  };

  let restored = false;

  const restoreTerminal = (): void => {
    if (restored) {
      return;
    }

    restored = true;

    if (stdin.isTTY) {
      stdin.setRawMode(false);
      stdin.off('data', onKeyPress);
      stdin.pause();
    }

    process.off('SIGINT', onSigint);
  };

  if (stdin.isTTY) {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onKeyPress);
  }

  process.on('SIGINT', onSigint);
  process.on('exit', restoreTerminal);

  try {
    await match(provider)
      .with('vercel', () => streamVercelLogs({ target, signal: controller.signal }))
      .with('deno', () => streamDenoLogs({ target, signal: controller.signal }))
      .with('cloudflare', () => streamCloudflareLogs({ target, signal: controller.signal }))
      .exhaustive();
  } finally {
    restoreTerminal();
    process.off('exit', restoreTerminal);
  }
};
