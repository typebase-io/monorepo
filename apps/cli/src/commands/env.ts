import { Command, Option } from '@commander-js/extra-typings';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { match } from 'ts-pattern';

import { serverProviders } from '#helpers/constants.ts';
import { addCloudflareEnvVar, getCloudflareEnvVar } from '#helpers/env/cloudflare.ts';
import { addDenoEnvVar, getDenoEnvVar } from '#helpers/env/deno.ts';
import { addVercelEnvVar, getVercelEnvVar } from '#helpers/env/vercel.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

const createTargetCommand = (target: 'dev' | 'prod') =>
  new Command(target)
    .summary(`Manage ${target} environment variables`)
    .addCommand(
      new Command('get')
        .summary('Get an environment variable')
        .argument('<key>', 'Environment variable name')
        .addOption(new Option('--provider <provider>', 'Deployment provider').choices(serverProviders))
        .allowExcessArguments(false)
        .action(async (key, options) => {
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

          const value = await match(provider)
            .with('vercel', () => getVercelEnvVar({ key, target }))
            .with('deno', () => getDenoEnvVar({ key, target }))
            .with('cloudflare', () => getCloudflareEnvVar({ key, target }))
            .exhaustive();

          if (value === undefined) {
            console.log(chalk.yellow(`Environment variable "${key}" not found.`));
          } else {
            console.log(value);
          }
        })
    )
    .addCommand(
      new Command('add')
        .summary('Add an environment variable')
        .argument('<key>', 'Environment variable name')
        .argument('<value>', 'Environment variable value')
        .addOption(new Option('--provider <provider>', 'Deployment provider').choices(serverProviders))
        .option('--encrypted', 'Encrypt the value (default: true)', true)
        .allowExcessArguments(false)
        .action(async (key, value, options) => {
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

          await match(provider)
            .with('vercel', () => addVercelEnvVar({ key, value, encrypted: options.encrypted, target }))
            .with('deno', () => addDenoEnvVar({ key, value, encrypted: options.encrypted, target }))
            .with('cloudflare', () => addCloudflareEnvVar({ key, value, target }))
            .exhaustive();

          console.log(chalk.green(`Environment variable "${key}" set for ${target}.`));
        })
    );

export const env = new Command('env')
  .summary('Manage environment variables on your deployment provider')
  .addCommand(createTargetCommand('dev'))
  .addCommand(createTargetCommand('prod'));
