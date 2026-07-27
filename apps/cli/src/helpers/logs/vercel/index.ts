import ora from 'ora';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';
import { getVercelProject } from '#helpers/deploy/vercel/get-vercel-project.ts';
import { getVercelToken } from '#helpers/deploy/vercel/get-vercel-token.ts';
import { printLine } from '#helpers/logs/vercel/print-line.ts';

const POLL_INTERVAL_MS = 2_000;
const WINDOW_MS = 60_000;
const MAX_SEEN_IDS = 5_000;

export const streamVercelLogs = async ({ target, signal }: { target: 'dev' | 'prod'; signal: AbortSignal }): Promise<void> => {
  const isAborted = () => signal.aborted;

  const token = await getVercelToken();
  const project = await getVercelProject(token);
  const client = new VercelClient({ token, orgId: project.orgId });

  const alias = `${project.projectId.replaceAll('_', '-')}-${target}.vercel.app`.toLowerCase();

  const spinner = ora({ text: `Looking up the ${target} deployment...`, discardStdin: false }).start();
  const deployment = await client.getDeployment({ idOrUrl: alias });

  if (!deployment) {
    spinner.fail(`No ${target} deployment found. Run \`typebase-io-cli deploy ${target}\` first.`);
    process.exitCode = 1;

    return;
  }

  spinner.succeed(`Streaming ${target} logs from https://${alias} — press "x" or Ctrl+C to stop.`);

  const seen = new Set<string>();

  while (!isAborted()) {
    const endDate = Date.now();

    try {
      const rows = await client.getRequestLogs({
        projectId: project.projectId,
        deploymentId: deployment.id,
        startDate: endDate - WINDOW_MS,
        endDate,
        signal,
      });

      const unseen = rows
        .filter((row) => {
          const rowKey = row.requestId ?? `${row.timestamp}-${row.requestMethod}-${row.requestPath}`;

          return !seen.has(rowKey);
        })
        .sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());

      for (const row of unseen) {
        const rowKey = row.requestId ?? `${row.timestamp}-${row.requestMethod}-${row.requestPath}`;

        seen.add(rowKey);
        printLine(row);
      }

      for (const key of seen) {
        if (seen.size <= MAX_SEEN_IDS) {
          break;
        }

        seen.delete(key);
      }
    } catch (error) {
      if (isAborted()) {
        return;
      }

      throw error;
    }

    if (!isAborted()) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, POLL_INTERVAL_MS);

        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );
      });
    }
  }
};
