import { type ChildProcess, spawn } from 'node:child_process';

import chalk from 'chalk';
import ora from 'ora';

import { stopProcessTree } from '#helpers/generate-server/stop-process-tree.ts';

export const runServerCommand = ({ command, cwd, forceAfterMs = 5_000 }: { command: string; cwd: string; forceAfterMs?: number }) => {
  let child: ChildProcess | undefined;
  let exited: Promise<void> = Promise.resolve();

  const stop = async () => {
    const current = child;

    if (!current) {
      return;
    }

    child = undefined;

    stopProcessTree(current);

    let force: NodeJS.Timeout | undefined;

    await Promise.race([
      exited,
      new Promise<void>((resolve) => {
        force = setTimeout(resolve, forceAfterMs);
      }),
    ]);

    clearTimeout(force);
    stopProcessTree(current, 'SIGKILL');

    await exited;
  };

  const start = () => {
    ora().info(chalk.dim(`Running \`${command}\`...`));

    const current = spawn(command, { cwd, shell: true, stdio: ['ignore', 'inherit', 'inherit'], detached: process.platform !== 'win32' });

    child = current;

    exited = new Promise<void>((resolve) => {
      current.once('error', (error) => {
        ora().fail(chalk.red(`\`${command}\` could not be started: ${error.message}`));

        resolve();
      });

      current.once('exit', (code) => {
        if (child === current && code !== null && code !== 0) {
          ora().fail(chalk.red(`\`${command}\` exited with code ${code}.`));
        }

        resolve();
      });
    });
  };

  return {
    restart: async () => {
      await stop();

      start();
    },
    stop,
    finished: () => exited,
  };
};
