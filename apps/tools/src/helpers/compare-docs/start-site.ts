import { type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { freePort } from '#helpers/compare-docs/free-port.ts';
import { runInBackground } from '#helpers/compare-docs/run-in-background.ts';
import { start } from '#helpers/compare-docs/start.ts';
import { type Check, type Revision, type RunningSite, type Side } from '#helpers/compare-docs/types.ts';

export const startSite = async (
  site: Revision,
  side: Side,
  output: string,
  children: Set<ChildProcess>,
  checks: Check[],
  isStopping: () => boolean = () => false
): Promise<RunningSite> => {
  await mkdir(path.join(output, 'logs'), { recursive: true });

  const steps = [
    ['install', ['install', '--frozen-lockfile']],
    ['lint', ['-C', 'apps/docs', 'lint']],
    ['build', ['-C', 'apps/docs', 'build']],
  ] as const;

  for (const [name, args] of steps) {
    if (isStopping()) throw new Error('Interrupted.');

    const log = `logs/${side}-${name}.log`;

    console.log(`[${side}] ${name} (${log})`);

    const check: Check = { side, name, log, status: 'passed' };

    checks.push(check);

    try {
      await start('pnpm', [...args], { cwd: site.directory, log: path.join(output, log), children }).done;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));

      check.status = 'failed';
      check.error = failure.message;

      if (name !== 'lint' || isStopping()) throw failure;

      console.warn(failure.message);
    }
  }

  const port = await freePort();

  if (isStopping()) throw new Error('Interrupted.');

  const origin = `http://127.0.0.1:${port}`;

  const child = runInBackground('pnpm', ['-C', 'apps/docs', 'exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: site.directory,
    log: path.join(output, `logs/${side}-server.log`),
    children,
  });

  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    if (isStopping()) throw new Error('Interrupted.');

    if (child.failure) throw child.failure;

    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(2000) });

      if (response.ok && child.exitCode === null) return { ...site, origin };
    } catch {
      /* Wait for this server to bind and finish startup. */
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`${side} server did not become ready within 90 seconds. See logs/${side}-server.log.`);
};
