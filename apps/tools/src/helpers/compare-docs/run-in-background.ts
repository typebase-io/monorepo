import { type ChildProcess } from 'node:child_process';

import { start } from '#helpers/compare-docs/start.ts';
import { type BackgroundProcess } from '#helpers/compare-docs/types.ts';

export const runInBackground = (
  command: string,
  args: string[],
  options: { cwd: string; log: string; children: Set<ChildProcess> }
): BackgroundProcess => {
  const { child, done } = start(command, args, options);
  const background: BackgroundProcess = child;

  done.catch((error: unknown) => {
    background.failure = error instanceof Error ? error : new Error(String(error));
  });

  return background;
};
