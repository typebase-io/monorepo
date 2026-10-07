import { Command, Option } from '@commander-js/extra-typings';
import { describe, expect, it, vi } from 'vitest';

import { getCommandTelemetryOptions } from '#helpers/analytics/get-command-telemetry-options.ts';

const parse = (args: string[]) => {
  const command = new Command('start')
    .option('--watch', 'Watch')
    .option('--no-encrypted', 'Unencrypted')
    .addOption(new Option('--provider <provider>', 'Provider').choices(['vercel', 'deno']))
    .option('--database-url <url>', 'Database URL')
    .addOption(new Option('--output <type>', 'Output').default('ts'))
    .action(vi.fn());

  command.parse(args, { from: 'user' });

  return getCommandTelemetryOptions(command);
};

describe('getCommandTelemetryOptions', () => {
  it('reports boolean options and choice values as given', () => {
    expect(parse(['--watch', '--no-encrypted', '--provider', 'deno'])).toEqual({ watch: true, encrypted: false, provider: 'deno' });
  });

  it('reports free-form values only as having been set', () => {
    expect(parse(['--database-url', 'postgres://user:secret@host/db'])).toEqual({ databaseUrl: true });
  });

  it('leaves out options that were not passed on the command line', () => {
    expect(parse([])).toEqual({});
  });
});
