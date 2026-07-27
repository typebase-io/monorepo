import ora from 'ora';

import { getDenoProject } from '#helpers/deploy/deno/get-deno-project.ts';
import { getDenoToken } from '#helpers/deploy/deno/get-deno-token.ts';
import { findTargetRevision } from '#helpers/logs/deno/find-target-revision.ts';
import { printLine } from '#helpers/logs/deno/print-line.ts';

const RECONNECT_DELAY_MS = 1_000;
const BACKFILL_MS = 60_000;

export const streamDenoLogs = async ({ target, signal }: { target: 'dev' | 'prod'; signal: AbortSignal }): Promise<void> => {
  const isAborted = () => signal.aborted;

  const token = await getDenoToken();
  const project = await getDenoProject(token);

  const spinner = ora({ text: `Looking up the ${target} deployment...`, discardStdin: false }).start();
  const revisionId = await findTargetRevision({ token, projectId: project.projectId, target });

  if (!revisionId) {
    spinner.fail(`No ${target} deployment found. Run \`typebase-io-cli deploy ${target}\` first.`);
    process.exitCode = 1;

    return;
  }

  const url = target === 'prod' ? `https://${project.slug}.${project.org}.deno.net` : `https://${project.slug}-${revisionId}.${project.org}.deno.net`;

  spinner.succeed(`Streaming ${target} logs from ${url} — press "x" or Ctrl+C to stop.`);

  const initialStart = new Date(Date.now() - BACKFILL_MS).toISOString();

  let lastPrinted = '';

  while (!isAborted()) {
    try {
      const params = new URLSearchParams({ start: lastPrinted || initialStart, revision_id: revisionId });

      const response = await fetch(`https://api.deno.com/v2/apps/${project.projectId}/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/x-ndjson' },
        signal,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const stream: ReadableStream<Uint8Array> | null = response.body;

      if (stream) {
        const decoder = new TextDecoder();
        let buffered = '';

        for await (const chunk of stream) {
          buffered += decoder.decode(chunk, { stream: true });

          const lastBreak = buffered.lastIndexOf('\n');

          if (lastBreak === -1) {
            continue;
          }

          for (const line of buffered.slice(0, lastBreak).split('\n')) {
            lastPrinted = printLine(line, lastPrinted);
          }

          buffered = buffered.slice(lastBreak + 1);
        }

        lastPrinted = printLine(buffered + decoder.decode(), lastPrinted);
      }
    } catch (error) {
      if (isAborted()) {
        return;
      }

      throw error;
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
