import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runGitCommand } from '#helpers/compare-docs/run-git-command.ts';
import { type Revision } from '#helpers/compare-docs/types.ts';

export const prepareWorktrees = async (
  root: string,
  base: string,
  candidate: string,
  keepCheckout: boolean,
  register: (directory: string) => void
): Promise<{ base: Revision; candidate: Revision }> => {
  const baseCommit = runGitCommand(root, 'rev-parse', '--verify', '--end-of-options', `${base}^{commit}`);
  const candidateCommit = runGitCommand(root, 'rev-parse', '--verify', '--end-of-options', `${candidate}^{commit}`);

  if (!keepCheckout && runGitCommand(root, 'status', '--porcelain', '--untracked-files=no')) {
    throw new Error(
      'Commit or stash tracked changes before switching branches, or use --keep-checkout to compare committed snapshots in two worktrees.'
    );
  }

  const directory = await mkdtemp(path.join(tmpdir(), 'typebase-compare-docs-'));
  const candidatePath = path.join(directory, 'candidate');

  runGitCommand(root, 'worktree', 'add', '--detach', candidatePath, candidateCommit);
  register(candidatePath);

  let basePath = root;

  if (keepCheckout) {
    basePath = path.join(directory, 'base');

    runGitCommand(root, 'worktree', 'add', '--detach', basePath, baseCommit);
    register(basePath);
  } else {
    runGitCommand(root, 'switch', '--', base);

    if (runGitCommand(root, 'rev-parse', 'HEAD') !== baseCommit) {
      throw new Error('Base branch changed while preparing the comparison. Please rerun.');
    }
  }

  return {
    base: { label: base, commit: baseCommit, directory: basePath },
    candidate: { label: candidate, commit: candidateCommit, directory: candidatePath },
  };
};
