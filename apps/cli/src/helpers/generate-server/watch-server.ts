import chalk from 'chalk';
import ora from 'ora';

import { watchDirectory } from '#helpers/shared/watch-directory.ts';

export const watchServer = async ({
  build,
  dirPath,
  ignoredDirPaths,
  signal,
  debounceMs = 100,
}: {
  build: (signal: AbortSignal, options: { rebuild: boolean }) => Promise<void>;
  dirPath: string;
  ignoredDirPaths?: string[];
  signal: AbortSignal;
  debounceMs?: number;
}): Promise<void> => {
  let controller: AbortController | undefined;
  let running = false;
  let rerunRequested = false;
  let lastChangeAt = 0;
  let watcherError: Error | undefined;
  let currentRun: Promise<void> = Promise.resolve();
  let built = false;

  const isStopped = () => signal.aborted || watcherError !== undefined;
  const shouldRerun = () => rerunRequested;
  const changedAt = () => lastChangeAt;

  const waitForQuiet = async () => {
    for (;;) {
      const quietFor = Date.now() - changedAt();

      if (isStopped() || quietFor >= debounceMs) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, debounceMs - quietFor));
    }
  };

  const runBuilds = async () => {
    running = true;

    try {
      do {
        await watcherReady;

        await waitForQuiet();

        if (isStopped()) {
          return;
        }

        rerunRequested = false;

        controller = new AbortController();

        const abortCurrent = () => controller?.abort();

        signal.addEventListener('abort', abortCurrent, { once: true });

        try {
          await build(controller.signal, { rebuild: built });

          built = true;
        } catch (err) {
          const isAbortError = err instanceof Error && err.name === 'AbortError';

          if (!isAbortError) {
            ora().fail(chalk.red(err instanceof Error ? err.message : String(err)));
          }
        } finally {
          signal.removeEventListener('abort', abortCurrent);
          controller = undefined;
        }

        if (!isStopped() && !shouldRerun()) {
          ora().info('Watching for changes... Press "x" or Ctrl+C to stop.');
        }
      } while (shouldRerun() && !isStopped());
    } finally {
      running = false;
    }
  };

  const startBuilds = () => {
    if (!running) {
      currentRun = runBuilds();
    }
  };

  let stopWaiting: (() => void) | undefined;

  const { ready: watcherReady, stop: stopWatching } = watchDirectory({
    dirPath,
    ignoredDirPaths,
    onChange: () => {
      if (isStopped()) {
        return;
      }

      lastChangeAt = Date.now();
      rerunRequested = true;

      controller?.abort();

      startBuilds();
    },
    onError: (error) => {
      watcherError = error;

      controller?.abort();
      stopWaiting?.();
    },
  });

  startBuilds();

  try {
    await new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();

        return;
      }

      stopWaiting = resolve;

      signal.addEventListener('abort', () => {
        resolve();
      });
    });
  } finally {
    await stopWatching();
    await currentRun;
  }

  if (watcherError) {
    throw new Error(`Stopped watching \`${dirPath}\`: ${watcherError.message}`);
  }
};
