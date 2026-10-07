import { Command } from '@commander-js/extra-typings';
import { describe, expect, it, vi } from 'vitest';

import { getCommandTarget } from '#helpers/analytics/get-command-target.ts';

describe('getCommandTarget', () => {
  it('reads the target from a `<target>` argument', () => {
    const deploy = new Command('deploy').argument('<target>').action(vi.fn());

    new Command('typebase-io-cli').addCommand(deploy).parse(['deploy', 'prod'], { from: 'user' });

    expect(getCommandTarget(deploy)).toBe('prod');
  });

  it('reads the target from a `dev` or `prod` parent command', () => {
    const add = new Command('add').argument('<key>').action(vi.fn());

    new Command('typebase-io-cli')
      .addCommand(new Command('env').addCommand(new Command('dev').addCommand(add)))
      .parse(['env', 'dev', 'add', 'SECRET'], { from: 'user' });

    expect(getCommandTarget(add)).toBe('dev');
  });

  it('returns undefined for commands without a target', () => {
    const codegen = new Command('codegen').action(vi.fn());

    new Command('typebase-io-cli').addCommand(codegen).parse(['codegen'], { from: 'user' });

    expect(getCommandTarget(codegen)).toBeUndefined();
  });
});
