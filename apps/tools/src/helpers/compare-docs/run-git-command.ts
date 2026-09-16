import { execFileSync } from 'node:child_process';

export const runGitCommand = (cwd: string, ...args: string[]): string => {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
};
