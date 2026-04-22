import { input } from '@inquirer/prompts';
import chalk from 'chalk';

import { readEnvVariable } from '#helpers/shared/read-env-variable.ts';
import { writeEnvFile } from '#helpers/shared/write-env-file.ts';

const TOKEN_KEY = 'CLOUDFLARE_API_TOKEN';

export const getCloudflareToken = async (): Promise<string> => {
  const envToken = readEnvVariable(TOKEN_KEY);

  if (envToken) {
    return envToken;
  }

  console.log(chalk.cyan('\nNo Cloudflare API token found. Create one at:'));
  console.log(chalk.underline('https://dash.cloudflare.com/profile/api-tokens'));
  console.log(chalk.gray('Use the "Edit Cloudflare Workers" template.\n'));

  const token = await input({ message: 'Paste your Cloudflare API token: ', required: true, validate: (val) => val.trim() !== '' });

  await writeEnvFile(TOKEN_KEY, token);

  console.log(chalk.green('Token saved to .env'));

  return token;
};
