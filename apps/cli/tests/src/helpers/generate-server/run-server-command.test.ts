import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runServerCommand } from '#helpers/generate-server/run-server-command.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('runServerCommand', () => {
  let tmp: TempDir;

  const until = async (predicate: () => boolean, label: string) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (predicate()) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(`Timed out waiting for ${label}.`);
  };

  const read = (file: string) => (fs.existsSync(path.join(tmp.path, file)) ? fs.readFileSync(path.join(tmp.path, file), 'utf8') : '');
  const longRunning = (marker: string) => `node -e "require('fs').appendFileSync('${marker}.txt', 'started\\n'); setInterval(() => {}, 1000)"`;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('runs the command in the generated server directory', async () => {
    const runner = runServerCommand({ command: `node -e "require('fs').writeFileSync('ran.txt', process.cwd())"`, cwd: tmp.path });

    await runner.restart();
    await runner.finished();

    expect(fs.realpathSync(read('ran.txt'))).toBe(fs.realpathSync(tmp.path));
  });

  it('resolves when a command that exits on its own is finished', async () => {
    const runner = runServerCommand({ command: `node -e "process.exit(0)"`, cwd: tmp.path });

    await runner.restart();

    await expect(runner.finished()).resolves.toBeUndefined();
  });

  it('stops the previous run before starting the next one', async () => {
    const runner = runServerCommand({ command: longRunning('server'), cwd: tmp.path });

    await runner.restart();
    await until(() => read('server.txt').includes('started'), 'the first run to start');

    await runner.restart();
    await until(() => read('server.txt').split('started').length === 3, 'the second run to start');

    await runner.stop();

    expect(read('server.txt').trim().split('\n')).toEqual(['started', 'started']);
  });

  it('leaves nothing running after stop', async () => {
    const runner = runServerCommand({ command: longRunning('alive'), cwd: tmp.path });

    await runner.restart();
    await until(() => read('alive.txt').includes('started'), 'the run to start');

    await runner.stop();

    await expect(runner.finished()).resolves.toBeUndefined();
  });

  it('kills the server the shell started, not just the shell', async () => {
    const runner = runServerCommand({
      command: `true && node -e "const fs=require('fs'); fs.writeFileSync('pid.txt', String(process.pid)); setInterval(() => {}, 1000)"`,
      cwd: tmp.path,
    });

    await runner.restart();
    await until(() => read('pid.txt') !== '', 'the server to report its pid');

    const pid = Number(read('pid.txt'));

    await runner.stop();

    await until(() => {
      try {
        process.kill(pid, 0);

        return false;
      } catch {
        return true;
      }
    }, 'the server process to be gone');

    expect(() => process.kill(pid, 0)).toThrow();
  });

  it('does not take the terminal input the watcher is listening for', async () => {
    const runner = runServerCommand({
      command: `node -e "const fs=require('fs'); process.stdin.on('end', () => { fs.writeFileSync('stdin.txt', 'ended'); process.exit(0); }); process.stdin.resume()"`,
      cwd: tmp.path,
    });

    await runner.restart();
    await runner.finished();

    expect(read('stdin.txt')).toBe('ended');
  });

  it('keeps working after a command that failed', async () => {
    const runner = runServerCommand({
      command: `node -e "require('fs').appendFileSync('attempts.txt', 'tried\\n'); process.exit(1)"`,
      cwd: tmp.path,
    });

    await runner.restart();
    await runner.finished();

    await runner.restart();
    await runner.finished();

    expect(read('attempts.txt').trim().split('\n')).toEqual(['tried', 'tried']);
  });

  it('takes down a command that ignores being asked to stop', async () => {
    const runner = runServerCommand({
      command: `true && node -e "process.on('SIGTERM', () => {}); require('fs').writeFileSync('stubborn.txt', String(process.pid)); setInterval(() => {}, 1000)"`,
      cwd: tmp.path,
      forceAfterMs: 200,
    });

    await runner.restart();
    await until(() => read('stubborn.txt') !== '', 'the stubborn command to start');

    const pid = Number(read('stubborn.txt'));

    await runner.stop();

    await until(() => {
      try {
        process.kill(pid, 0);

        return false;
      } catch {
        return true;
      }
    }, 'the stubborn command to be gone');
  });

  it('does nothing when stopped before it was ever started', async () => {
    const runner = runServerCommand({ command: longRunning('never'), cwd: tmp.path });

    await expect(runner.stop()).resolves.toBeUndefined();
    expect(read('never.txt')).toBe('');
  });

  it('reports a command that could not be spawned at all', async () => {
    const runner = runServerCommand({ command: `node -e "process.exit(0)"`, cwd: path.join(tmp.path, 'not-generated-yet') });

    await runner.restart();

    await expect(runner.finished()).resolves.toBeUndefined();
  });

  it('survives a command that cannot run, so a watcher keeps going', async () => {
    const runner = runServerCommand({ command: 'definitely-not-a-real-command-xyz', cwd: tmp.path });

    await runner.restart();

    await expect(runner.finished()).resolves.toBeUndefined();

    await runner.restart();
    await runner.stop();
  });
});
