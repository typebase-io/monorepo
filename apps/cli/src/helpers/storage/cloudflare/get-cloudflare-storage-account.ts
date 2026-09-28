import { select } from '@inquirer/prompts';

import { CloudflareClient } from '#helpers/deploy/cloudflare/client.ts';
import { type getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

export const getCloudflareStorageAccount = async ({
  token,
  config,
}: {
  token: string;
  config: Awaited<ReturnType<typeof getTypebaseConfig>>;
}): Promise<{ accountId: string; isNew: boolean }> => {
  if (config.storage?.cloudflare) {
    return { accountId: config.storage.cloudflare.accountId, isNew: false };
  }

  const accounts = await new CloudflareClient({ token, accountId: undefined }).listAccounts();

  if (accounts.length === 0) {
    throw new Error(
      'Your Cloudflare token cannot reach any account to keep R2 buckets in. Create a token with access to an account, then sync again.'
    );
  }

  const accountId = await select({
    message: 'Select the Cloudflare account that holds your R2 buckets:',
    choices: accounts.map(({ id, name }) => ({ name, value: id })),
  });

  return { accountId, isNew: true };
};
