import fs from 'node:fs';
import path from 'node:path';

import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPackageManager } from '#helpers/shared/get-package-manager.ts';
import { installServerDependencies } from '#helpers/start/install-server-dependencies.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/shared/get-package-manager.ts', () => ({ getPackageManager: vi.fn() }));

describe('installServerDependencies', () => {
  let tmp: TempDir;
  let originalPath: string | undefined;

  const shim = (name: string, body: string) => {
    const filePath = tmp.write(`bin/${name}`, `#!/bin/sh\n${body}\n`);

    fs.chmodSync(filePath, 0o755);
  };

  const recordingShim = (name: string) => {
    shim(name, `printf '%s' "$PWD:$*" > '${path.join(tmp.path, 'called.txt')}'`);
  };

  const recorded = () => (fs.existsSync(path.join(tmp.path, 'called.txt')) ? fs.readFileSync(path.join(tmp.path, 'called.txt'), 'utf8') : '');

  const until = async (predicate: () => boolean, label: string) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (predicate()) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(`Timed out waiting for ${label}.`);
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tmp = createTempDir();
    originalPath = process.env.PATH;

    tmp.mkdir('bin');

    process.env.PATH = `${path.join(tmp.path, 'bin')}${path.delimiter}${originalPath ?? ''}`;

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.PATH = originalPath;

    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    { packageManager: 'npm', binary: 'npm', args: 'install --force' },
    { packageManager: 'pnpm', binary: 'pnpm', args: 'install --no-strict-peer-dependencies' },
    { packageManager: 'yarn-classic', binary: 'yarn', args: 'install' },
    { packageManager: 'yarn-berry', binary: 'yarn', args: 'install' },
    { packageManager: 'bun', binary: 'bun', args: 'install' },
    { packageManager: 'unknown', binary: 'npm', args: 'install --force' },
  ] as const)('installs with $binary in the server directory for $packageManager', async ({ packageManager, binary, args }) => {
    vi.mocked(getPackageManager).mockResolvedValue(packageManager);

    recordingShim(binary);

    const serverDirPath = tmp.mkdir('server');

    await installServerDependencies({ dirPath: serverDirPath });

    expect(recorded()).toBe(`${fs.realpathSync(serverDirPath)}:${args}`);
  });

  it('rejects when the package manager exits non-zero, naming the command that failed', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('npm');

    shim('npm', 'exit 7');

    await expect(installServerDependencies({ dirPath: tmp.mkdir('server') })).rejects.toThrow(/npm install --force.*7/);
  });

  it('rejects when the package manager cannot be spawned at all', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('pnpm');

    process.env.PATH = path.join(tmp.path, 'bin');

    await expect(installServerDependencies({ dirPath: tmp.mkdir('server') })).rejects.toThrow(
      '`pnpm install --no-strict-peer-dependencies` could not be started: spawn pnpm ENOENT'
    );
  });

  it('keeps the package manager off the screen while it works, and shows a spinner instead', async () => {
    vi.mocked(getPackageManager).mockResolvedValue('npm');

    shim('npm', `echo 'added 71 packages'`);

    const written = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await installServerDependencies({ dirPath: tmp.mkdir('server') });

    expect(written.mock.calls.flat().map(String).join('')).not.toContain('added 71 packages');
    expect(vi.mocked(ora).mock.calls.flat().map(String).join('')).toContain('Installing dependencies...');
    expect(vi.mocked(ora()).succeed.mock.calls.flat().map(String).join('')).toContain('Dependencies installed.');
  });

  it("surfaces the package manager's own output when it fails", async () => {
    vi.mocked(getPackageManager).mockResolvedValue('npm');

    shim('npm', `echo 'ERESOLVE could not resolve' >&2; exit 1`);

    await expect(installServerDependencies({ dirPath: tmp.mkdir('server') })).rejects.toThrow('ERESOLVE could not resolve');

    expect(vi.mocked(ora()).fail.mock.calls.flat().map(String).join('')).toContain('Failed to install dependencies.');
  });

  describe('an install that never finishes', () => {
    it('is stopped once it runs past the timeout', async () => {
      vi.mocked(getPackageManager).mockResolvedValue('npm');

      shim('npm', 'sleep 30');

      await expect(installServerDependencies({ dirPath: tmp.mkdir('server'), timeoutMs: 150 })).rejects.toThrow(
        '`npm install --force` was still running after 0s, so it was stopped.'
      );
    });

    it('leaves nothing of it running, not even what a shell started', async () => {
      const pidFile = path.join(tmp.path, 'install-pid.txt');

      await expect(
        installServerDependencies({
          dirPath: tmp.mkdir('server'),
          command: `true && node -e "require('fs').writeFileSync('${pidFile}', String(process.pid)); setInterval(() => {}, 1000)"`,
          timeoutMs: 500,
        })
      ).rejects.toThrow('was still running after 1s, so it was stopped.');

      const pid = Number(fs.readFileSync(pidFile, 'utf8'));

      expect(pid).toBeGreaterThan(0);

      await until(() => {
        try {
          process.kill(pid, 0);

          return false;
        } catch {
          return true;
        }
      }, 'the install to be gone');
    });

    it('does not stop an install that finishes in time', async () => {
      vi.mocked(getPackageManager).mockResolvedValue('npm');

      shim('npm', 'exit 0');

      await expect(installServerDependencies({ dirPath: tmp.mkdir('server'), timeoutMs: 10_000 })).resolves.toBeUndefined();
    });
  });

  describe('given a custom install command', () => {
    it('runs it instead of the package manager', async () => {
      vi.mocked(getPackageManager).mockResolvedValue('pnpm');

      recordingShim('pnpm');

      const serverDirPath = tmp.mkdir('server');

      await installServerDependencies({ dirPath: serverDirPath, command: `printf '%s' "custom:$PWD" > '${path.join(tmp.path, 'called.txt')}'` });

      expect(recorded()).toBe(`custom:${fs.realpathSync(serverDirPath)}`);
      expect(getPackageManager).not.toHaveBeenCalled();
    });

    it('runs it through a shell, so it can be anything the developer writes', async () => {
      await installServerDependencies({
        dirPath: tmp.mkdir('server'),
        command: `true && printf '%s' 'shelled' > '${path.join(tmp.path, 'called.txt')}'`,
      });

      expect(recorded()).toBe('shelled');
    });

    it('rejects when it fails, naming the command and showing its output', async () => {
      await expect(installServerDependencies({ dirPath: tmp.mkdir('server'), command: `echo 'no lockfile' >&2; exit 3` })).rejects.toThrow(
        /`echo 'no lockfile' >&2; exit 3` failed with exit code 3[\s\S]*no lockfile/
      );
    });
  });
});
