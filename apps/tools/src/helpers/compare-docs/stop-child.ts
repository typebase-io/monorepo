import { type ChildProcess } from 'child_process';

export const stopChild = (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const { pid } = child;

  if (pid === undefined) {
    child.kill('SIGTERM');

    return;
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }

  const timer = setTimeout(() => {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      /* Process already exited. */
    }
  }, 3000);

  timer.unref();

  child.once('exit', () => {
    clearTimeout(timer);
  });
};
