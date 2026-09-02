import { type ChildProcess } from 'node:child_process';

export const stopProcessTree = (child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM') => {
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);

      return;
    } catch {
      // The group is already gone, or could not be signalled. Fall back to the child itself.
    }
  }

  child.kill(signal);
};
