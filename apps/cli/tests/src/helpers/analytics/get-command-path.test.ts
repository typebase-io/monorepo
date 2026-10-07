import { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';

import { getCommandPath } from '#helpers/analytics/get-command-path.ts';

describe('getCommandPath', () => {
  it('joins the subcommand names below the program', () => {
    const add = new Command('add');

    new Command('typebase-io-cli').addCommand(new Command('env').addCommand(new Command('prod').addCommand(add)));

    expect(getCommandPath(add)).toBe('env prod add');
  });

  it('returns the name of a top-level command', () => {
    const deploy = new Command('deploy');

    new Command('typebase-io-cli').addCommand(deploy);

    expect(getCommandPath(deploy)).toBe('deploy');
  });

  it('returns an empty path for the program itself', () => {
    expect(getCommandPath(new Command('typebase-io-cli'))).toBe('');
  });
});
