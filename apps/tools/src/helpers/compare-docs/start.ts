import { type ChildProcess, spawn } from 'child_process';
import { closeSync, openSync } from 'fs';

export const start = (command: string, args: string[], { cwd, log, children }: { cwd: string; log: string; children: Set<ChildProcess> }) => {
  const descriptor = openSync(log, 'a');

  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', descriptor, descriptor],
    detached: true,
    env: { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1', FORCE_COLOR: '0' },
  });

  closeSync(descriptor);

  children.add(child);

  const done = new Promise<void>((resolve, reject) => {
    child.once('error', (error) => {
      children.delete(child);
      reject(error);
    });

    child.once('exit', (code, signal) => {
      children.delete(child);

      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed (${code ?? signal}). See ${log}`));
    });
  });

  return { child, done };
};
