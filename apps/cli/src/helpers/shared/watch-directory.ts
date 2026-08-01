import path from 'node:path';

import { watch } from 'chokidar';

export const watchDirectory = ({
  dirPath,
  ignoredDirPaths = [],
  onChange,
  onError,
}: {
  dirPath: string;
  ignoredDirPaths?: string[];
  onChange: () => void;
  onError?: (error: Error) => void;
}) => {
  const root = path.resolve(dirPath);
  const ignoredPaths = ignoredDirPaths.map((ignored) => path.resolve(ignored)).filter((ignored) => ignored.startsWith(`${root}${path.sep}`));

  const watcher = watch(root, {
    ignoreInitial: true,
    ignored: (candidate) => {
      const resolved = path.resolve(candidate);

      return ignoredPaths.some((ignored) => resolved === ignored || resolved.startsWith(`${ignored}${path.sep}`));
    },
  });

  let markReady!: () => void;

  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  watcher.on('ready', () => {
    markReady();
  });

  watcher.on('error', () => {
    markReady();
  });

  watcher.on('all', () => {
    onChange();
  });

  watcher.on('error', (error) => {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  });

  const stop = async () => {
    markReady();

    await watcher.close();
  };

  return { ready, stop };
};
