import ora from 'ora';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 10 * 60 * 1_000;

export const waitForDeployment = async ({
  token,
  deploymentId,
  orgId,
  type,
}: {
  token: string;
  deploymentId: string;
  orgId: string | undefined;
  type: 'normal' | 'placeholder';
}): Promise<void> => {
  const vercel = new VercelClient({ token, orgId });
  const lower = type === 'placeholder' ? 'placeholder deployment' : 'deployment';
  const upper = type === 'placeholder' ? 'Placeholder deployment' : 'Deployment';

  const spinner = ora(`Waiting for ${lower} to be ready...`).start();
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const deploymentState = await vercel.getDeploymentState({ deploymentId });

    if (deploymentState === 'READY') {
      spinner.succeed(`${upper} is ready!`);

      return;
    }

    if (deploymentState === 'ERROR') {
      spinner.fail(`${upper} failed.`);
      throw new Error(`${upper} ${deploymentId} ended in ERROR state.`);
    }

    if (deploymentState === 'CANCELED') {
      spinner.fail(`${upper} was canceled.`);
      throw new Error(`${upper} ${deploymentId} was canceled.`);
    }

    spinner.text = `${upper} state: ${deploymentState}...`;
  }

  spinner.fail(`${upper} timed out.`);

  throw new Error(`${lower} did not become ready within the time limit.`);
};
