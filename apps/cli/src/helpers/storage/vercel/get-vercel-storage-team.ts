import { select } from '@inquirer/prompts';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { type getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

export const getVercelStorageTeam = async ({
  token,
  config,
}: {
  token: string;
  config: Awaited<ReturnType<typeof getTypebaseConfig>>;
}): Promise<{ orgId: string; isNew: boolean }> => {
  if (config.storage?.vercel) {
    return { orgId: config.storage.vercel.orgId, isNew: false };
  }

  const teams = await new VercelClient({ token, orgId: undefined }).listTeams();

  if (teams.length === 0) {
    throw new Error('Your Vercel token cannot reach any team to keep Blob stores in. Create a token with access to a team, then sync again.');
  }

  const orgId = await select({
    message: 'Select the Vercel team that holds your Blob stores:',
    choices: teams.map(({ id, name, slug }) => ({ name: `${name} (${slug})`, value: id })),
  });

  return { orgId, isNew: true };
};
