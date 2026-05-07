import path from 'node:path';

import { input, select } from '@inquirer/prompts';
import ora from 'ora';
import { match } from 'ts-pattern';

import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

export const getCloudflareWorker = async (token: string) => {
  const config = await getTypebaseConfig();

  if (config.cloudflare) {
    return {
      accountId: config.cloudflare.accountId,
      workerName: config.cloudflare.workerName,
      subdomain: config.cloudflare.subdomain,
    };
  }

  const accountsSpinner = ora('Fetching accounts...').start();
  const accountsRes = await fetch('https://api.cloudflare.com/client/v4/accounts', { headers: { Authorization: `Bearer ${token}` } });

  if (!accountsRes.ok) {
    accountsSpinner.fail('Failed to fetch accounts.');

    const body = await accountsRes.text();
    throw new Error(`Failed to fetch Cloudflare accounts: ${body}`);
  }

  const accountsData = (await accountsRes.json()) as { result: { id: string; name: string }[] };
  const accounts = accountsData.result;

  accountsSpinner.stop();

  if (accounts.length === 0) {
    throw new Error('No Cloudflare accounts found for this token.');
  }

  const accountId =
    accounts.length === 1
      ? (accounts.at(0)?.id ?? '')
      : await select({
          message: 'Select a Cloudflare account:',
          choices: accounts.map((account) => ({
            name: account.name,
            value: account.id,
          })),
        });

  const workersSpinner = ora('Fetching workers...').start();

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    workersSpinner.fail('Failed to fetch workers.');

    const body = await res.text();
    throw new Error(`Failed to fetch Cloudflare workers: ${body}`);
  }

  const data = (await res.json()) as { result: { id: string }[] };
  const workers = data.result;

  workersSpinner.stop();

  const selectedWorker =
    workers.length === 0
      ? '__create_new__'
      : await select({
          message: 'Select a worker to deploy to:',
          choices: [
            {
              name: '+ Create a new worker',
              value: '__create_new__',
            },
            ...workers.map((worker) => ({
              name: worker.id,
              value: worker.id,
            })),
          ],
        });

  const workerName = await match(selectedWorker)
    .with('__create_new__', async () => {
      return input({
        message: 'Worker name:',
        default: path.basename(process.cwd()),
        prefill: 'editable',
        required: true,
        validate: (val) => val.trim() !== '',
      });
    })
    .otherwise((value) => value);

  const subdomainSpinner = ora('Fetching account subdomain...').start();

  const subdomainRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!subdomainRes.ok) {
    subdomainSpinner.fail('Failed to fetch subdomain.');

    const body = await subdomainRes.text();
    throw new Error(`Failed to fetch Cloudflare subdomain: ${body}`);
  }

  const subdomainData = (await subdomainRes.json()) as { result: { subdomain: string } };
  const subdomain = subdomainData.result.subdomain;

  subdomainSpinner.stop();

  await writeTypebaseConfig({ cloudflare: { accountId, workerName, subdomain } });

  ora().succeed('Config saved to typebase.json.');

  return { accountId, workerName, subdomain };
};
