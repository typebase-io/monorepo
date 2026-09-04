import { describe, expect, it } from 'vitest';

import { getDependencyInstallCommand } from '#helpers/generate-server/get-dependency-install-command.ts';

describe('getDependencyInstallCommand', () => {
  it.each(['npm', 'pnpm', 'yarn-classic', 'yarn-berry', 'bun', 'unknown'] as const)('formats commands for %s', (packageManager) => {
    const runtime = getDependencyInstallCommand({ packageManager, dependencies: { pg: '8.20.0', zod: '^4 || ^5' }, development: false });
    const development = getDependencyInstallCommand({ packageManager, dependencies: { typescript: '5.9.3' }, development: true });

    expect(`${runtime}\n${development}\n`).toEqualTemplate('get-dependency-install-command', `${packageManager}.txt`);
  });

  it('omits the command when there are no missing dependencies', () => {
    expect(getDependencyInstallCommand({ packageManager: 'npm', dependencies: {}, development: false })).toBeUndefined();
  });

  it('quotes shell metacharacters and single quotes in dependency specifications', () => {
    expect(
      `${getDependencyInstallCommand({ packageManager: 'npm', dependencies: { custom: "file:../it's a $(command); package" }, development: false })}\n`
    ).toEqualTemplate('get-dependency-install-command', 'escaped.txt');
  });
});
