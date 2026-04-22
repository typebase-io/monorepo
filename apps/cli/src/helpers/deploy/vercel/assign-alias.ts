import ora from 'ora';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';

export const assignAlias = async ({
  token,
  deploymentId,
  projectId,
  orgId,
  target,
}: {
  token: string;
  deploymentId: string;
  projectId: string;
  orgId: string | undefined;
  target: 'dev' | 'prod';
}) => {
  const spinner = ora('Assigning alias to deployment...').start();

  const vercel = new VercelClient({ token, orgId });
  const alias = `${projectId.replaceAll('_', '-')}-${target}.vercel.app`;

  await vercel.assignAlias({ deploymentId, alias });

  spinner.succeed('Alias assigned.');

  return alias;
};
