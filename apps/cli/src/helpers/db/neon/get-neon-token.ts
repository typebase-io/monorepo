import { input } from '@inquirer/prompts';
import chalk from 'chalk';

import { readEnvVariable } from '#helpers/shared/read-env-variable.ts';
import { writeEnvFile } from '#helpers/shared/write-env-file.ts';

const TOKEN_KEY = 'NEON_API_KEY';

export const getNeonToken = async (): Promise<string> => {
  const envToken = readEnvVariable(TOKEN_KEY);

  if (envToken) {
    return envToken;
  }

  console.log(chalk.cyan('\nNo Neon API key found. Create one at:'));
  console.log(chalk.underline('https://console.neon.tech/app/settings/api-keys\n'));

  const token = await input({ message: 'Paste your Neon API key: ', required: true, validate: (val) => val.trim() !== '' });

  await writeEnvFile(TOKEN_KEY, token);

  console.log(chalk.green('Token saved to .env'));

  return token;
};
