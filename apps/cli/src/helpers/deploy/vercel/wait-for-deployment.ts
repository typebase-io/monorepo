import ora from 'ora';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 10 * 60 * 1_000;

export const waitForDeployment = async ({
  token,
  deploymentId,
  orgId,
}: {
  token: string;
  deploymentId: string;
  orgId: string | undefined;
}): Promise<void> => {
  const vercel = new VercelClient({ token, orgId });
  const spinner = ora('Waiting for deployment to be ready...').start();
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const deploymentState = await vercel.getDeploymentState({ deploymentId });

    if (deploymentState === 'READY') {
      spinner.succeed('Deployment is ready!');
      return;
    }

    if (deploymentState === 'ERROR') {
      spinner.fail('Deployment failed.');
      throw new Error(`Deployment ${deploymentId} ended in ERROR state.`);
    }

    if (deploymentState === 'CANCELED') {
      spinner.fail('Deployment was canceled.');
      throw new Error(`Deployment ${deploymentId} was canceled.`);
    }

    spinner.text = `Deployment state: ${deploymentState}...`;
  }

  spinner.fail('Deployment timed out.');

  throw new Error('Deployment did not become ready within the time limit.');
};
