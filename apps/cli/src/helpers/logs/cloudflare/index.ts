import ora from 'ora';

import { getCloudflareToken } from '#helpers/deploy/cloudflare/get-cloudflare-token.ts';
import { getCloudflareWorker } from '#helpers/deploy/cloudflare/get-cloudflare-worker.ts';
import { createTail } from '#helpers/logs/cloudflare/create-tail.ts';
import { listenUntilClosed } from '#helpers/logs/cloudflare/listen-until-closed.ts';

const RECONNECT_DELAY_MS = 1_000;

export const streamCloudflareLogs = async ({ target, signal }: { target: 'dev' | 'prod'; signal: AbortSignal }): Promise<void> => {
  const isAborted = () => signal.aborted;

  if (typeof WebSocket === 'undefined') {
    throw new Error('Streaming Cloudflare logs needs the global WebSocket, available from Node 22.4. Upgrade Node and run this command again.');
  }

  const token = await getCloudflareToken();
  const worker = await getCloudflareWorker(token);
  const scriptName = target === 'dev' ? `${worker.workerName}-preview` : worker.workerName;

  const spinner = ora({ text: `Looking up the ${target} deployment...`, discardStdin: false }).start();

  let tail = await createTail({ token, accountId: worker.accountId, scriptName });

  if (!tail) {
    spinner.fail(`No ${target} deployment found. Run \`typebase-io-cli deploy ${target}\` first.`);
    process.exitCode = 1;

    return;
  }

  spinner.succeed(`Streaming ${target} logs from https://${scriptName}.${worker.subdomain}.workers.dev — press "x" or Ctrl+C to stop.`);

  while (!isAborted()) {
    try {
      tail ??= await createTail({ token, accountId: worker.accountId, scriptName });

      if (!tail) {
        throw new Error(`The worker "${scriptName}" is no longer available on this Cloudflare account.`);
      }

      await listenUntilClosed({ url: tail.url, signal });
    } finally {
      const closingSpinner = isAborted() ? ora({ text: 'Closing the log stream...', discardStdin: false }).start() : undefined;

      await tail?.deleteTail();

      closingSpinner?.succeed('Log stream closed.');
      tail = undefined;
    }

    if (!isAborted()) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, RECONNECT_DELAY_MS);

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
