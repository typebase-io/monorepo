import ora from 'ora';

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 10 * 60 * 1_000;

export const waitForDeployment = async ({ token, revisionId }: { token: string; revisionId: string }): Promise<void> => {
  const spinner = ora('Waiting for deployment to be ready...').start();
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`https://api.deno.com/v2/revisions/${revisionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      spinner.fail('Failed to check deployment status.');
      throw new Error(`Failed to fetch revision status: ${res.statusText}`);
    }

    const revision = (await res.json()) as { status: string; failure_reason?: string | null };
    const state = revision.status;

    if (state === 'succeeded') {
      spinner.succeed('Deployment is ready!');

      return;
    }

    if (state === 'failed') {
      spinner.fail('Deployment failed.');
      throw new Error(`Revision ${revisionId} failed: ${revision.failure_reason ?? 'unknown'}`);
    }

    if (state === 'skipped') {
      spinner.fail('Deployment was skipped.');
      throw new Error(`Revision ${revisionId} was skipped.`);
    }

    spinner.text = `Deployment state: ${state}...`;
  }

  spinner.fail('Deployment timed out.');

  throw new Error('Deployment did not become ready within the time limit.');
};
