import { select } from '@inquirer/prompts';
import { type createApiClient } from '@neondatabase/api-client';
import chalk from 'chalk';
import ora from 'ora';

export const getNeonOrganization = async (apiClient: ReturnType<typeof createApiClient>): Promise<string> => {
  const orgsSpinner = ora('Fetching organizations...').start();
  const orgsRes = await apiClient.getCurrentUserOrganizations();
  const orgs = orgsRes.data.organizations;

  orgsSpinner.stop();

  if (orgs.length === 0) {
    console.error(chalk.red('No Neon organizations found for your account.'));
    process.exit(1);
  }

  if (orgs.length === 1) {
    const org = orgs[0] ?? { name: '', id: '' };

    console.log(chalk.gray(`Using organization: ${org.name}`));

    return org.id;
  }

  return select({
    message: 'Select a Neon organization:',
    choices: orgs.map((org) => ({
      name: org.name,
      value: org.id,
    })),
  });
};
