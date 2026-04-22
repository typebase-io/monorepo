import { input } from '@inquirer/prompts';
import chalk from 'chalk';

import { readEnvVariable } from '#helpers/shared/read-env-variable.ts';
import { writeEnvFile } from '#helpers/shared/write-env-file.ts';

const TOKEN_KEY = 'DENO_DEPLOY_TOKEN';

export const getDenoToken = async (): Promise<string> => {
  const envToken = readEnvVariable(TOKEN_KEY);

  if (envToken) {
    return envToken;
  }

  console.log(chalk.cyan('\nNo Deno Deploy token found. Create one at:'));
  console.log(chalk.underline('https://console.deno.com (Settings → Organization tokens)\n'));

  const token = await input({ message: 'Paste your Deno Deploy token: ', required: true, validate: (val) => val.trim() !== '' });

  await writeEnvFile(TOKEN_KEY, token);

  console.log(chalk.green('Token saved to .env'));

  return token;
};
