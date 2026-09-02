import { type SpawnOptions, spawn } from 'node:child_process';

import ora from 'ora';

import { stopProcessTree } from '#helpers/generate-server/stop-process-tree.ts';
import { getPackageManagerInstallCommand } from '#helpers/shared/get-package-manager-install-command.ts';

export const installServerDependencies = async ({
  dirPath,
  command,
  timeoutMs = 600_000,
}: {
  dirPath: string;
  command?: string;
  timeoutMs?: number;
}): Promise<void> => {
  const installCommand = command ?? (await getPackageManagerInstallCommand());
  const [binary = '', ...args] = installCommand.split(' ');

  const spinner = ora('Installing dependencies...').start();
  const options: SpawnOptions = { cwd: dirPath, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' };
  const child = command ? spawn(command, { ...options, shell: true }) : spawn(binary, args, options);

  let output = '';

  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));

  let timer: NodeJS.Timeout | undefined;

  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => {
        stopProcessTree(child);
        stopProcessTree(child, 'SIGKILL');

        reject(new Error(`\`${installCommand}\` was still running after ${Math.round(timeoutMs / 1000)}s, so it was stopped.\n\n${output.trim()}`));
      }, timeoutMs);

      child.once('error', (error) => {
        reject(new Error(`\`${installCommand}\` could not be started: ${error.message}`));
      });

      child.once('exit', (code, signal) => {
        if (code === 0) {
          resolve();

          return;
        }

        reject(new Error(`\`${installCommand}\` failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.\n\n${output.trim()}`));
      });
    });
  } catch (err) {
    spinner.fail('Failed to install dependencies.');

    throw err;
  } finally {
    clearTimeout(timer);
  }

  spinner.succeed('Dependencies installed.');
};
