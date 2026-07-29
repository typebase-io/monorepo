import { Command, InvalidArgumentError, Option } from '@commander-js/extra-typings';
import { select } from '@inquirer/prompts';
import { match } from 'ts-pattern';

import { serverProviders } from '#helpers/constants.ts';
import { streamLogs } from '#helpers/logs/stream-logs.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

export const logs = new Command('logs')
  .summary('Stream logs from your deployed server')
  .description('Stream runtime logs from your deployed Typebase server in real time. Press "x" or Ctrl+C to stop.')
  .argument('<target>', 'Deployment target (dev or prod)', (target) => {
    if (!['dev', 'prod'].includes(target)) {
      throw new InvalidArgumentError('Target must be "dev" or "prod".');
    }

    return target as 'dev' | 'prod';
  })
  .addOption(new Option('--provider <provider>', 'Deployment provider').choices(serverProviders))
  .allowExcessArguments(false)
  .action(async (target, options) => {
    const { serverProvider } = await getTypebaseConfig();

    const provider = await match(options.provider)
      .with(undefined, () => {
        if (serverProvider) {
          return serverProvider;
        }

        return select({
          message: 'Select a deploy provider:',
          choices: serverProviders.map((provider) => ({ name: provider, value: provider })),
        });
      })
      .otherwise((provider) => provider);

    await streamLogs({ target, provider });
  });
