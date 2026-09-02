import { type ChildProcess, type SpawnOptions, spawn } from 'node:child_process';
import path from 'node:path';

import chalk from 'chalk';
import ora from 'ora';

import { stopProcessTree } from '#helpers/generate-server/stop-process-tree.ts';

export const runServerCommand = ({
  command,
  args,
  cwd,
  forceAfterMs = 5_000,
}: {
  command: string;
  args?: string[];
  cwd: string;
  forceAfterMs?: number;
}) => {
  const label = args ? [path.basename(command), ...args].join(' ') : command;

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
    ora().info(chalk.dim(`Running \`${label}\`...`));

    const options: SpawnOptions = { cwd, stdio: ['ignore', 'inherit', 'inherit'], detached: process.platform !== 'win32' };
    const current = args ? spawn(command, args, options) : spawn(command, { ...options, shell: true });

    child = current;

    exited = new Promise<void>((resolve) => {
      current.once('error', (error) => {
        ora().fail(chalk.red(`\`${label}\` could not be started: ${error.message}`));

        resolve();
      });

      current.once('exit', (code) => {
        if (child === current && code !== null && code !== 0) {
          ora().fail(chalk.red(`\`${label}\` exited with code ${code}.`));
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
