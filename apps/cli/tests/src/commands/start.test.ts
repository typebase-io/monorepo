import fs from 'node:fs';
import path from 'node:path';

import { confirm, input, select } from '@inquirer/prompts';
import * as dotenv from 'dotenv';
import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '#commands/db.ts';
import { start } from '#commands/start.ts';

import { applyMigrations } from '#helpers/db/apply-migrations.ts';
import { neon } from '#helpers/db/neon/index.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';
import { watchServer } from '#helpers/generate-server/watch-server.ts';
import { type RunPrompt, runUntilStopped } from '#helpers/shared/run-until-stopped.ts';
import { getServerCacheDirPath } from '#helpers/start/get-server-cache-dir-path.ts';
import { installServerDependencies } from '#helpers/start/install-server-dependencies.ts';
import { isPortAvailable } from '#helpers/start/is-port-available.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { createAbandonedServerCache } from '#tests/helpers/server-cache.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/shared/validate-types.ts', () => ({ validateTypes: vi.fn() }));
vi.mock('#helpers/db/apply-migrations.ts', () => ({ applyMigrations: vi.fn() }));
vi.mock('#helpers/db/neon/index.ts', () => ({ neon: vi.fn() }));
vi.mock('#helpers/db/push-schema.ts', () => ({ pushSchema: vi.fn() }));
vi.mock('#helpers/start/install-server-dependencies.ts', () => ({ installServerDependencies: vi.fn() }));
vi.mock('#helpers/start/is-port-available.ts', () => ({ isPortAvailable: vi.fn() }));
vi.mock('#helpers/shared/run-until-stopped.ts', () => ({ runUntilStopped: vi.fn() }));
vi.mock('#helpers/generate-server/watch-server.ts', () => ({ watchServer: vi.fn() }));

const runPrompt = <T>(ask: () => Promise<T>) => ask();

describe('start command', () => {
  let tmp: TempDir;
  let originalCacheHome: string | undefined;
  let originalExecPath: PropertyDescriptor | undefined;
  let originalTypeScriptSupport: PropertyDescriptor | undefined;

  const succeeded = () => vi.mocked(ora()).succeed.mock.calls.flat().map(String).join('\n');

  const warned = () => vi.mocked(ora()).warn.mock.calls.flat().map(String).join('\n');

  const informed = () => vi.mocked(ora()).info.mock.calls.flat().map(String).join('\n');

  const started = () => vi.mocked(ora).mock.calls.flat().map(String).join('\n');

  const typebaseDirPath = () => path.join(tmp.path, 'typebase');

  const serverDirPath = () => path.join(getServerCacheDirPath(typebaseDirPath()), 'server');

  const inServer = (...segments: string[]) => path.join(serverDirPath(), ...segments);

  const marker = () => path.join(tmp.path, 'marker.txt');

  const markerArg = () => `'${marker()}'`;

  const readMarker = () => (fs.existsSync(marker()) ? fs.readFileSync(marker(), 'utf8') : '');

  const nodeInvocation = () => path.join(tmp.path, 'node-invocation.txt');

  const readNodeInvocation = () => (fs.existsSync(nodeInvocation()) ? fs.readFileSync(nodeInvocation(), 'utf8') : '');

  const projectEnv = () => (fs.existsSync(path.join(tmp.path, '.env')) ? dotenv.parse(fs.readFileSync(path.join(tmp.path, '.env'), 'utf8')) : {});

  const until = async (predicate: () => boolean, label: string) => {
    for (let attempt = 0; attempt < 1200; attempt += 1) {
      if (predicate()) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(`Timed out waiting for ${label}.`);
  };

  const watchUntil = (predicate: () => boolean, label: string) => {
    vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
      if (signal.aborted) {
        return;
      }

      await build(signal, { rebuild: false });

      await until(predicate, label);
    });
  };

  const setupProject = async () => {
    await generateTypebaseProject(tmp, { withAuth: false });

    fs.rmSync(path.join(tmp.path, 'typebase/db'), { recursive: true, force: true });
  };

  const pretendNodeCannotRunTypeScript = () => {
    Object.defineProperty(process.features, 'typescript', { value: false, configurable: true, enumerable: true });
  };

  beforeEach(() => {
    vi.clearAllMocks();

    start.exitOverride();
    start.configureOutput({ writeErr: () => undefined });

    tmp = createTempDir();

    originalCacheHome = process.env.XDG_CACHE_HOME;
    originalExecPath = Object.getOwnPropertyDescriptor(process, 'execPath');
    originalTypeScriptSupport = Object.getOwnPropertyDescriptor(process.features, 'typescript');

    process.env.XDG_CACHE_HOME = tmp.mkdir('cache');

    const nodePath = tmp.write(
      'bin/node',
      `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(nodeInvocation())}, process.argv.slice(2).join('\\n'));\n`
    );

    fs.chmodSync(nodePath, 0o755);
    Object.defineProperty(process, 'execPath', { ...originalExecPath, value: nodePath });

    linkTypebaseIo(tmp);

    vi.mocked(isPortAvailable).mockResolvedValue(true);
    vi.mocked(applyMigrations).mockResolvedValue({ applied: [] });
    vi.mocked(pushSchema).mockResolvedValue({ sqlStatements: [] });
    vi.mocked(runUntilStopped).mockImplementation((run) => run(new AbortController().signal, runPrompt));
    vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
      if (signal.aborted) {
        return;
      }

      await build(signal, { rebuild: false });
    });

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalCacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = originalCacheHome;
    }

    if (originalTypeScriptSupport) {
      Object.defineProperty(process.features, 'typescript', originalTypeScriptSupport);
    }

    if (originalExecPath) {
      Object.defineProperty(process, 'execPath', originalExecPath);
    }

    tmp.cleanup();

    process.exitCode = 0;

    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('builds the server, installs its dependencies and starts it in the cache', async () => {
    await setupProject();

    watchUntil(() => readMarker() !== '', 'the server to report where it is running');

    await withCwd(tmp.path, () =>
      start.parseAsync(['--command', `node -e "require('fs').writeFileSync(${markerArg()}, process.cwd())"`], { from: 'user' })
    );

    expect(fs.existsSync(inServer('src/index.ts'))).toBe(true);
    expect(installServerDependencies).toHaveBeenCalledWith({ dirPath: serverDirPath(), command: undefined });
    expect(fs.realpathSync(readMarker())).toBe(fs.realpathSync(serverDirPath()));
  });

  it('leaves announcing the address to the server itself, which logs it on startup', async () => {
    await setupProject();

    watchUntil(() => readNodeInvocation() !== '', 'the server to start');

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(succeeded()).not.toContain('127.0.0.1');
    expect(fs.readFileSync(inServer('src/index.ts'), 'utf8')).toContain('Listening on 127.0.0.1:8080');
  });

  it('keeps the server out of the project, under the cache directory', async () => {
    await setupProject();

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(fs.existsSync(path.join(tmp.path, 'typebase/_server'))).toBe(false);
    expect(serverDirPath().startsWith(path.join(tmp.path, 'cache'))).toBe(true);
    expect(fs.existsSync(inServer('package.json'))).toBe(true);
  });

  it('keeps the dependencies an earlier run installed', async () => {
    await setupProject();

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    fs.mkdirSync(path.join(serverDirPath(), 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(serverDirPath(), 'node_modules', 'installed.txt'), 'from the last run');

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(fs.existsSync(path.join(serverDirPath(), 'node_modules', 'installed.txt'))).toBe(true);
    expect(fs.existsSync(inServer('src/index.ts'))).toBe(true);
  });

  it('installs with a custom install command when one is given', async () => {
    await setupProject();

    await withCwd(tmp.path, () => start.parseAsync(['--install-command', 'pnpm install --frozen-lockfile'], { from: 'user' }));

    expect(installServerDependencies).toHaveBeenCalledWith({ dirPath: serverDirPath(), command: 'pnpm install --frozen-lockfile' });
  });

  it('recovers a cache an interrupted run left holding dependencies and no server', async () => {
    await setupProject();

    fs.mkdirSync(path.join(serverDirPath(), 'node_modules'), { recursive: true });

    await expect(withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }))).resolves.not.toThrow();

    expect(fs.existsSync(inServer('src/index.ts'))).toBe(true);
  });

  it('never reads a server left in the project by the generator as a source of dependencies', async () => {
    await setupProject();

    tmp.write('typebase/_server/src/actions/stale.ts', `import { leftOver } from 'left-over-package';\n\nexport const stale = leftOver;\n`);

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(fs.readFileSync(inServer('package.json'), 'utf8')).not.toContain('left-over-package');
  });

  it('runs the TypeScript server directly on a Node that can execute it', async () => {
    await setupProject();

    watchUntil(() => readNodeInvocation() !== '', 'the server to start');

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(fs.existsSync(inServer('src/index.ts'))).toBe(true);
    expect(fs.existsSync(inServer('src/index.js'))).toBe(false);
    expect(readNodeInvocation()).toBe('src/index.ts');
    expect(informed()).toContain('node src/index.ts');
    expect(warned()).toBe('');
  });

  it('transpiles and warns on a Node that cannot execute TypeScript', async () => {
    pretendNodeCannotRunTypeScript();

    await setupProject();

    watchUntil(() => readNodeInvocation() !== '', 'the server to start');

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(fs.existsSync(inServer('src/index.js'))).toBe(true);
    expect(fs.existsSync(inServer('src/index.ts'))).toBe(false);
    expect(readNodeInvocation()).toBe('src/index.js');
    expect(informed()).toContain('node src/index.js');
    expect(warned()).toContain('Node 22.18 or newer');
  });

  it('lets an explicit output override the detection, without the warning', async () => {
    pretendNodeCannotRunTypeScript();

    await setupProject();

    await withCwd(tmp.path, () => start.parseAsync(['--output', 'ts'], { from: 'user' }));

    expect(fs.existsSync(inServer('src/index.ts'))).toBe(true);
    expect(warned()).toBe('');
  });

  it('never consults the configured output format', async () => {
    tmp.write('typebase.json', JSON.stringify({ server: { output: 'cjs' } }));

    await setupProject();

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(fs.existsSync(inServer('src/index.ts'))).toBe(true);
  });

  it('always uses the node adapter, whatever the project configured', async () => {
    tmp.write('typebase.json', JSON.stringify({ server: { adapter: 'fastify' } }));

    await setupProject();

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(fs.readFileSync(inServer('src/index.ts'), 'utf8')).toContain('node:http');
    expect(fs.readFileSync(inServer('package.json'), 'utf8')).not.toContain('fastify');
  });

  it('honours the configured port', async () => {
    tmp.write('typebase.json', JSON.stringify({ server: { port: 3210 } }));

    await setupProject();

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(fs.readFileSync(inServer('src/index.ts'), 'utf8')).toContain('3210');
    expect(projectEnv().TYPEBASE_APP_URL_LOCAL).toBe('http://127.0.0.1:3210');
  });

  it('lets the port option override the configured port', async () => {
    tmp.write('typebase.json', JSON.stringify({ server: { port: 3210 } }));

    await setupProject();

    await withCwd(tmp.path, () => start.parseAsync(['--port', '4321'], { from: 'user' }));

    expect(fs.readFileSync(inServer('src/index.ts'), 'utf8')).toContain('4321');
    expect(projectEnv().TYPEBASE_APP_URL_LOCAL).toBe('http://127.0.0.1:4321');
  });

  describe('port availability', () => {
    it('checks the port it is about to start on, before anything is generated or started', async () => {
      await setupProject();

      watchUntil(() => readNodeInvocation() !== '', 'the server to start');

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(isPortAvailable).toHaveBeenCalledWith(8080);
      expect(isPortAvailable).toHaveBeenCalledBefore(vi.mocked(runUntilStopped));
      expect(readNodeInvocation()).toBe('src/index.ts');
    });

    it('checks the port the option chose rather than the default one', async () => {
      await setupProject();

      await withCwd(tmp.path, () => start.parseAsync(['--port', '4321'], { from: 'user' }));

      expect(isPortAvailable).toHaveBeenCalledWith(4321);
    });

    it('fails with the port option named, generating and starting nothing, when the port is busy', async () => {
      vi.mocked(isPortAvailable).mockResolvedValue(false);

      await setupProject();

      await expect(
        withCwd(tmp.path, () => start.parseAsync(['--command', `node -e "require('fs').writeFileSync(${markerArg()}, 'started')"`], { from: 'user' }))
      ).rejects.toThrow('Port 8080 is already in use. Pass a different one with --port.');

      expect(readMarker()).toBe('');
      expect(readNodeInvocation()).toBe('');
      expect(fs.existsSync(serverDirPath())).toBe(false);
      expect(installServerDependencies).not.toHaveBeenCalled();
      expect(runUntilStopped).not.toHaveBeenCalled();
    });

    it('names the busy port the option chose', async () => {
      vi.mocked(isPortAvailable).mockResolvedValue(false);

      await setupProject();

      await expect(withCwd(tmp.path, () => start.parseAsync(['--port', '4321'], { from: 'user' }))).rejects.toThrow(
        'Port 4321 is already in use. Pass a different one with --port.'
      );
    });

    it('never checks again on a rebuild, when the port is held by the server being replaced', async () => {
      vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
        await build(signal, { rebuild: false });
        await build(signal, { rebuild: true });
      });

      await setupProject();

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(isPortAvailable).toHaveBeenCalledOnce();
      expect(succeeded()).toContain('Server restarted!');
    });
  });

  describe('abandoned server caches', () => {
    it('prunes the cache of a project that no longer exists, keeping its own', async () => {
      await setupProject();

      const abandoned = createAbandonedServerCache(tmp, 'deleted-app');

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(fs.existsSync(abandoned)).toBe(false);
      expect(fs.existsSync(inServer('src/index.ts'))).toBe(true);
    });

    it('starts the server anyway when a cache cannot be pruned', async () => {
      await setupProject();

      const undeletable = createAbandonedServerCache(tmp, 'undeletable-app');

      fs.chmodSync(undeletable, 0o555);

      watchUntil(() => readNodeInvocation() !== '', 'the server to start');

      try {
        await expect(withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }))).resolves.not.toThrow();

        expect(fs.existsSync(undeletable)).toBe(true);
        expect(readNodeInvocation()).toBe('src/index.ts');
      } finally {
        fs.chmodSync(undeletable, 0o755);
      }
    });
  });

  describe('the loop', () => {
    const watchOptions = () => vi.mocked(watchServer).mock.calls[0]?.[0];

    const markerLines = () => readMarker().trim().split('\n').filter(Boolean);

    const appendingCommand = () =>
      `true && node -e "const fs=require('fs'); fs.appendFileSync(${markerArg()}, process.pid + '\\n'); setInterval(() => {}, 1000)"`;

    const isRunning = (pid: number) => {
      try {
        process.kill(pid, 0);

        return true;
      } catch {
        return false;
      }
    };

    const setupProjectWithDatabase = async () => {
      await generateTypebaseProject(tmp, { withAuth: false });

      tmp.write('.env', 'DATABASE_URL_LOCAL=postgres://project/local\n');
    };

    const actionFilePath = 'typebase/actions/queries/todos.ts';

    const touchAction = () => {
      tmp.write(actionFilePath, `${tmp.read(actionFilePath)}\n// touched\n`);
    };

    const addDependencyToAction = () => {
      tmp.write(actionFilePath, `import 'left-over-package';\n${tmp.read(actionFilePath)}`);
    };

    const touchSchema = () => {
      tmp.write('typebase/db/schema.ts', `${tmp.read('typebase/db/schema.ts')}\n// touched\n`);
    };

    const rebuildAfter = (change: () => void) => {
      vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
        await build(signal, { rebuild: false });

        change();

        await build(signal, { rebuild: true });
      });
    };

    it('watches the typebase directory until the run is stopped', async () => {
      await setupProject();

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(watchOptions()?.dirPath).toBe(typebaseDirPath());
      expect(watchOptions()?.signal).toBeInstanceOf(AbortSignal);
    });

    it('never watches the server cache, nor the types a build writes into the project', async () => {
      await setupProject();

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(watchOptions()?.ignoredDirPaths).toContain(getServerCacheDirPath(typebaseDirPath()));
      expect(watchOptions()?.ignoredDirPaths).toContain(path.join(typebaseDirPath(), '_generated'));
    });

    it('clears the last run and says it is rebuilding, before saying it restarted', async () => {
      const cleared = vi.spyOn(console, 'clear').mockImplementation(() => undefined);

      await setupProject();

      rebuildAfter(touchAction);

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(cleared).toHaveBeenCalledOnce();
      expect(started()).toContain('Rebuilding...');
      expect(succeeded()).toContain('Server restarted!');
    });

    it('restarts the server on a rebuild, not only on the first build', async () => {
      await setupProject();

      vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
        await build(signal, { rebuild: false });

        await until(() => markerLines().length === 1, 'the server to start');

        await build(signal, { rebuild: true });

        await until(() => markerLines().length === 2, 'the rebuild to restart it');
      });

      await withCwd(tmp.path, () => start.parseAsync(['--command', appendingCommand()], { from: 'user' }));

      const pids = markerLines().map(Number);

      expect(pids).toHaveLength(2);
      expect(pids[0]).not.toBe(pids[1]);

      await until(() => pids.every((pid) => !isRunning(pid)), 'every server to be gone');
    });

    it('installs dependencies once when a rebuild leaves the generated manifest unchanged', async () => {
      await setupProject();

      rebuildAfter(touchAction);

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(installServerDependencies).toHaveBeenCalledOnce();
    });

    it('installs dependencies again when a rebuild changes the generated manifest', async () => {
      await setupProject();

      rebuildAfter(addDependencyToAction);

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(installServerDependencies).toHaveBeenCalledTimes(2);
      expect(fs.readFileSync(inServer('package.json'), 'utf8')).toContain('left-over-package');
    });

    it('never touches the database when a rebuild only changes an action', async () => {
      await setupProjectWithDatabase();

      rebuildAfter(touchAction);

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledOnce();
    });

    it('brings the database back in step when a rebuild changes the database directory', async () => {
      await setupProjectWithDatabase();

      rebuildAfter(touchSchema);

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledTimes(2);
    });

    it('runs both steps again on the next run, keeping no gate state on disk', async () => {
      await setupProjectWithDatabase();

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));
      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(installServerDependencies).toHaveBeenCalledTimes(2);
      expect(pushSchema).toHaveBeenCalledTimes(2);
    });

    it('lets a failing first build reach the watcher rather than ending the run', async () => {
      await setupProject();

      tmp.write('typebase/auth.ts', 'export const auth = {};\n');

      vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
        await expect(build(signal, { rebuild: false })).rejects.toThrow('better-auth keeps users and sessions in your database');
      });

      await expect(withCwd(tmp.path, () => start.parseAsync(['--command', appendingCommand()], { from: 'user' }))).resolves.not.toThrow();

      expect(markerLines()).toHaveLength(0);
      expect(installServerDependencies).not.toHaveBeenCalled();
    });

    it('lets a failing rebuild reach the watcher, without restarting the server', async () => {
      await setupProject();

      vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
        await build(signal, { rebuild: false });

        await until(() => markerLines().length === 1, 'the server to start');

        tmp.write('typebase/auth.ts', 'export const auth = {};\n');

        await expect(build(signal, { rebuild: true })).rejects.toThrow('better-auth keeps users and sessions in your database');

        expect(markerLines()).toHaveLength(1);
      });

      await expect(withCwd(tmp.path, () => start.parseAsync(['--command', appendingCommand()], { from: 'user' }))).resolves.not.toThrow();
    });

    it('leaves the running server alive on its old code when a rebuild fails to install', async () => {
      vi.mocked(installServerDependencies)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('`npm install` failed with exit code 1.'));

      await setupProject();

      vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
        await build(signal, { rebuild: false });

        await until(() => markerLines().length === 1, 'the server to start');

        addDependencyToAction();

        await expect(build(signal, { rebuild: true })).rejects.toThrow('`npm install` failed with exit code 1.');

        expect(markerLines()).toHaveLength(1);
        expect(isRunning(Number(markerLines()[0]))).toBe(true);
      });

      await expect(withCwd(tmp.path, () => start.parseAsync(['--command', appendingCommand()], { from: 'user' }))).resolves.not.toThrow();
    });

    it('keeps the run alive when a rebuild fails to bring the database in step', async () => {
      vi.mocked(pushSchema).mockResolvedValueOnce({ sqlStatements: [] }).mockRejectedValueOnce(new Error('Connection refused.'));

      await setupProjectWithDatabase();

      vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
        await build(signal, { rebuild: false });

        await until(() => markerLines().length === 1, 'the server to start');

        touchSchema();

        await expect(build(signal, { rebuild: true })).rejects.toThrow('Connection refused.');

        expect(markerLines()).toHaveLength(1);
      });

      await expect(withCwd(tmp.path, () => start.parseAsync(['--command', appendingCommand()], { from: 'user' }))).resolves.not.toThrow();
    });
  });

  it('never asks the developer anything', async () => {
    await setupProject();

    await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

    expect(select).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
  });

  it('stops cleanly when the run is stopped while the server is still building', async () => {
    const controller = new AbortController();

    controller.abort();

    vi.mocked(runUntilStopped).mockImplementation((run) => run(controller.signal, runPrompt));

    await setupProject();

    await expect(
      withCwd(tmp.path, () => start.parseAsync(['--command', `node -e "require('fs').writeFileSync(${markerArg()}, 'started')"`], { from: 'user' }))
    ).resolves.not.toThrow();

    expect(readMarker()).toBe('');
    expect(installServerDependencies).not.toHaveBeenCalled();
  });

  it('stops the server when the run is stopped, leaving no process behind', async () => {
    const controller = new AbortController();

    vi.mocked(runUntilStopped).mockImplementation(async (run) => {
      void until(() => readMarker() !== '', 'the server to start').then(() => {
        controller.abort();
      });

      await run(controller.signal, runPrompt);
    });

    vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
      await build(signal, { rebuild: false });

      await until(() => signal.aborted, 'the run to be stopped');
    });

    await setupProject();

    await withCwd(tmp.path, () =>
      start.parseAsync(
        ['--command', `true && node -e "require('fs').writeFileSync(${markerArg()}, String(process.pid)); setInterval(() => {}, 1000)"`],
        { from: 'user' }
      )
    );

    const pid = Number(readMarker());

    expect(pid).toBeGreaterThan(0);

    await until(() => {
      try {
        process.kill(pid, 0);

        return false;
      } catch {
        return true;
      }
    }, 'the server to be gone');
  });

  it('stops with what the installer said when it fails with something that is not an Error', async () => {
    vi.mocked(installServerDependencies).mockRejectedValueOnce('`npm install` was killed.');

    await setupProject();

    await expect(withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }))).rejects.toThrow('`npm install` was killed.');

    expect(readNodeInvocation()).toBe('');
  });

  it('stops instead of starting a server when the install fails', async () => {
    vi.mocked(installServerDependencies).mockRejectedValueOnce(new Error('`npm install --force` failed with exit code 1.'));

    await setupProject();

    await expect(
      withCwd(tmp.path, () => start.parseAsync(['--command', `node -e "require('fs').writeFileSync(${markerArg()}, 'started')"`], { from: 'user' }))
    ).rejects.toThrow('`npm install --force` failed with exit code 1.');

    expect(readMarker()).toBe('');
  });

  describe('database', () => {
    const setupProjectWithDatabase = () => generateTypebaseProject(tmp, { withAuth: false });

    const serverEnv = () => (fs.existsSync(inServer('.env')) ? dotenv.parse(fs.readFileSync(inServer('.env'), 'utf8')) : {});

    const everyDatabaseInTheProject = () => {
      tmp.write(
        '.env',
        ['DATABASE_URL_LOCAL=postgres://project/local', 'DATABASE_URL_DEV=postgres://project/dev', 'DATABASE_URL=postgres://project/production'].join(
          '\n'
        ) + '\n'
      );
    };

    const nothingHappened = () => {
      expect(fs.existsSync(serverDirPath())).toBe(false);
      expect(installServerDependencies).not.toHaveBeenCalled();
      expect(runUntilStopped).not.toHaveBeenCalled();
      expect(pushSchema).not.toHaveBeenCalled();
      expect(applyMigrations).not.toHaveBeenCalled();
    };

    it('fails before generating or installing when no database is chosen and the project has no local one', async () => {
      await setupProjectWithDatabase();

      await expect(withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }))).rejects.toThrow(
        'No local database URL found. Set DATABASE_URL_LOCAL in .env, or choose another database with --database-url, --dev-database or --prod-database.'
      );

      nothingHappened();
    });

    it.each([
      { name: 'nothing is chosen', args: [] as string[], url: 'postgres://project/local', source: 'DATABASE_URL_LOCAL' },
      { name: 'the dev database is chosen', args: ['--dev-database'], url: 'postgres://project/dev', source: 'DATABASE_URL_DEV' },
      { name: 'the production database is chosen', args: ['--prod-database'], url: 'postgres://project/production', source: 'DATABASE_URL' },
      {
        name: 'a URL is passed',
        args: ['--database-url', 'postgres://somewhere/else'],
        url: 'postgres://somewhere/else',
        source: 'the --database-url option',
      },
    ])('runs against the database in $source when $name, and says so', async ({ args, url, source }) => {
      await setupProjectWithDatabase();

      everyDatabaseInTheProject();

      await withCwd(tmp.path, () => start.parseAsync(args, { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: url }));
      expect(serverEnv().DATABASE_URL).toBe(url);
      expect(informed()).toContain(`Using the database from ${source}.`);
    });

    it.each([
      { name: 'a URL and the dev database', args: ['--database-url', 'postgres://somewhere/else', '--dev-database'] },
      { name: 'a URL and the production database', args: ['--database-url', 'postgres://somewhere/else', '--prod-database'] },
      { name: 'the dev and the production database', args: ['--dev-database', '--prod-database'] },
    ])('refuses $name, before generating or installing anything', async ({ args }) => {
      await setupProjectWithDatabase();

      everyDatabaseInTheProject();

      await expect(withCwd(tmp.path, () => start.parseAsync(args, { from: 'user' }))).rejects.toThrow('cannot be used with');

      nothingHappened();
    });

    it('never reaches for another database when the one it was asked for is missing', async () => {
      await setupProjectWithDatabase();

      tmp.write('.env', 'DATABASE_URL_LOCAL=postgres://project/local\n');

      await expect(withCwd(tmp.path, () => start.parseAsync(['--prod-database'], { from: 'user' }))).rejects.toThrow(
        'No database URL found in DATABASE_URL. Set it in .env, or pass one with --database-url.'
      );

      nothingHappened();
    });

    it('skips the database step entirely for a project without a schema', async () => {
      await setupProject();

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(pushSchema).not.toHaveBeenCalled();
      expect(applyMigrations).not.toHaveBeenCalled();
      expect(neon).not.toHaveBeenCalled();
      expect(fs.existsSync(inServer('src/index.ts'))).toBe(true);
    });

    it('pushes the schema in push mode and makes the generated server use the same URL', async () => {
      await setupProjectWithDatabase();

      fs.mkdirSync(serverDirPath(), { recursive: true });
      fs.writeFileSync(inServer('package.json'), '{"name":"@typebase-io/server"}\n');
      fs.writeFileSync(inServer('.env'), 'DATABASE_URL=postgres://stale/database\n');

      await withCwd(tmp.path, () => start.parseAsync(['--database-url', 'postgres://option/database'], { from: 'user' }));

      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ connectionUri: 'postgres://option/database', skipConfirmation: false }));
      expect(applyMigrations).not.toHaveBeenCalled();
      expect(serverEnv().DATABASE_URL).toBe('postgres://option/database');
    });

    it('applies pending migrations in migrations mode and reports the result', async () => {
      await setupProjectWithDatabase();
      tmp.write('.env', 'DATABASE_URL_LOCAL=postgres://project/local\n');
      tmp.mkdir('typebase/db/migrations');

      vi.mocked(applyMigrations).mockResolvedValue({ applied: ['20260101000000_initial', '20260201000000_add_priority'] });

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(applyMigrations).toHaveBeenCalledWith({
        migrationsDirPath: path.join(tmp.path, 'typebase/db/migrations'),
        connectionUri: 'postgres://project/local',
      });
      expect(pushSchema).not.toHaveBeenCalled();
      expect(succeeded()).toContain('2 migrations applied.');
    });

    it('reports a single applied migration in the singular', async () => {
      await setupProjectWithDatabase();
      tmp.write('.env', 'DATABASE_URL_LOCAL=postgres://project/local\n');
      tmp.mkdir('typebase/db/migrations');

      vi.mocked(applyMigrations).mockResolvedValue({ applied: ['20260101000000_initial'] });

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(succeeded()).toContain('1 migration applied.');
    });

    it('says nothing about unrecorded changes when every schema change is already recorded', async () => {
      await setupProjectWithDatabase();
      tmp.write('.env', 'DATABASE_URL_LOCAL=postgres://project/local\n');
      tmp.mkdir('typebase/db/migrations');

      await withCwd(tmp.path, () => db.parseAsync(['migrations', 'generate', '--name', 'initial'], { from: 'user' }));
      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(warned()).not.toContain('no migration records');
      expect(applyMigrations).toHaveBeenCalledOnce();
    });

    it('warns and continues when schema changes are unrecorded in migrations mode', async () => {
      await setupProjectWithDatabase();
      tmp.write('.env', 'DATABASE_URL_LOCAL=postgres://project/local\n');
      tmp.mkdir('typebase/db/migrations');

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(warned()).toContain('schema files have changes that no migration records, affecting todos');
      expect(applyMigrations).toHaveBeenCalledOnce();
    });

    it('pre-answers only the destructive schema-change prompt when the flag is set', async () => {
      await setupProjectWithDatabase();

      await withCwd(tmp.path, () =>
        start.parseAsync(['--database-url', 'postgres://option/database', '--skip-schema-changes-confirmation'], { from: 'user' })
      );

      expect(pushSchema).toHaveBeenCalledWith(expect.objectContaining({ skipConfirmation: true }));
    });

    it('runs destructive confirmation inside the stop-key prompt lifecycle', async () => {
      let promptCalls = 0;
      const prompt: RunPrompt = <T>(ask: () => Promise<T>): Promise<T> => {
        promptCalls += 1;

        return ask();
      };

      vi.mocked(runUntilStopped).mockImplementation((run) => run(new AbortController().signal, prompt));
      vi.mocked(pushSchema).mockImplementation(async ({ prompt: runPrompt }) => {
        await runPrompt?.(() => Promise.resolve(true));

        return { sqlStatements: [] };
      });

      await setupProjectWithDatabase();

      await withCwd(tmp.path, () => start.parseAsync(['--database-url', 'postgres://option/database'], { from: 'user' }));

      expect(promptCalls).toBe(1);
    });

    it('does not start the server when the run is stopped after destructive confirmation', async () => {
      const controller = new AbortController();
      const prompt: RunPrompt = async <T>(ask: () => Promise<T>): Promise<T> => {
        const answer = await ask();

        controller.abort();

        return answer;
      };

      vi.mocked(runUntilStopped).mockImplementation((run) => run(controller.signal, prompt));
      vi.mocked(pushSchema).mockImplementation(async ({ prompt: runPrompt }) => {
        await runPrompt?.(() => Promise.resolve(true));

        return { sqlStatements: [] };
      });

      await setupProjectWithDatabase();

      await withCwd(tmp.path, () => start.parseAsync(['--database-url', 'postgres://option/database'], { from: 'user' }));

      expect(informed()).not.toContain('Running');
      expect(readNodeInvocation()).toBe('');
    });

    it('reports nothing to the watcher when Ctrl+C at the prompt stops the run mid-build', async () => {
      const controller = new AbortController();
      const stoppedAtPrompt = Object.assign(new Error(''), { name: 'StoppedAtPrompt' });

      const prompt: RunPrompt = () => {
        controller.abort();

        throw stoppedAtPrompt;
      };

      vi.mocked(runUntilStopped).mockImplementation((run) => run(controller.signal, prompt));
      vi.mocked(pushSchema).mockImplementation(async ({ prompt: runPrompt }) => {
        await runPrompt?.(() => Promise.resolve(true));

        return { sqlStatements: [] };
      });

      vi.mocked(watchServer).mockImplementation(async ({ build, signal }) => {
        await expect(build(signal, { rebuild: false })).resolves.toBeUndefined();
      });

      await setupProjectWithDatabase();

      await expect(
        withCwd(tmp.path, () => start.parseAsync(['--database-url', 'postgres://option/database'], { from: 'user' }))
      ).resolves.not.toThrow();

      expect(readNodeInvocation()).toBe('');
    });

    it('does not select or provision a provider, or write provider configuration', async () => {
      await setupProjectWithDatabase();

      await withCwd(tmp.path, () => start.parseAsync(['--database-url', 'postgres://option/database'], { from: 'user' }));

      expect(select).not.toHaveBeenCalled();
      expect(neon).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(tmp.path, 'typebase.json'))).toBe(false);
    });
  });

  describe('auth and the local URL', () => {
    const setupProjectWithAuth = async () => {
      await generateTypebaseProject(tmp, { withAuth: true });
      tmp.write('.env', 'DATABASE_URL_LOCAL=postgres://project/local\n');
    };

    const serverEnv = () => (fs.existsSync(inServer('.env')) ? dotenv.parse(fs.readFileSync(inServer('.env'), 'utf8')) : {});

    it('generates an auth secret and saves it in the project, where a later deploy will find it', async () => {
      await setupProjectWithAuth();

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(projectEnv().BETTER_AUTH_SECRET).toMatch(/.{16,}/);
      expect(serverEnv().BETTER_AUTH_SECRET).toBe(projectEnv().BETTER_AUTH_SECRET);
    });

    it('reuses the secret already in the project env file rather than replacing it', async () => {
      await setupProjectWithAuth();

      tmp.write('.env', 'DATABASE_URL_LOCAL=postgres://project/local\nBETTER_AUTH_SECRET=already-chosen\n');

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(projectEnv().BETTER_AUTH_SECRET).toBe('already-chosen');
      expect(serverEnv().BETTER_AUTH_SECRET).toBe('already-chosen');
    });

    it('writes no secret when the environment already carries one', async () => {
      vi.stubEnv('BETTER_AUTH_SECRET', 'from-the-environment');

      await setupProjectWithAuth();

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(projectEnv().BETTER_AUTH_SECRET).toBeUndefined();
    });

    it('never generates a secret for a project without auth', async () => {
      await setupProject();

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(projectEnv().BETTER_AUTH_SECRET).toBeUndefined();
      expect(serverEnv().BETTER_AUTH_SECRET).toBeUndefined();
    });

    it.each([
      { name: 'the port the server listens on', args: [] as string[], url: 'http://127.0.0.1:8080' },
      { name: 'a port chosen with the port option', args: ['--port', '4321'], url: 'http://127.0.0.1:4321' },
    ])('writes the local application URL for $name', async ({ args, url }) => {
      await setupProject();

      await withCwd(tmp.path, () => start.parseAsync(args, { from: 'user' }));

      expect(projectEnv().TYPEBASE_APP_URL_LOCAL).toBe(url);
    });

    it('keeps the local URL current when the port changes', async () => {
      await setupProject();

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));
      await withCwd(tmp.path, () => start.parseAsync(['--port', '4321'], { from: 'user' }));

      expect(projectEnv().TYPEBASE_APP_URL_LOCAL).toBe('http://127.0.0.1:4321');
    });

    it('writes nothing to the project env file but the local URL and the auth secret', async () => {
      await setupProjectWithAuth();

      tmp.write(
        '.env',
        [
          'DATABASE_URL=postgres://project/main',
          'DATABASE_URL_DEV=postgres://project/dev',
          'DATABASE_URL_LOCAL=postgres://project/local',
          'VERCEL_TOKEN=vercel-token',
          'DENO_DEPLOY_TOKEN=deno-token',
          'CLOUDFLARE_API_TOKEN=cloudflare-token',
        ].join('\n') + '\n'
      );

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(Object.keys(projectEnv()).sort()).toEqual([
        'BETTER_AUTH_SECRET',
        'CLOUDFLARE_API_TOKEN',
        'DATABASE_URL',
        'DATABASE_URL_DEV',
        'DATABASE_URL_LOCAL',
        'DENO_DEPLOY_TOKEN',
        'TYPEBASE_APP_URL_LOCAL',
        'VERCEL_TOKEN',
      ]);

      expect(projectEnv().DATABASE_URL).toBe('postgres://project/main');
      expect(projectEnv().DATABASE_URL_DEV).toBe('postgres://project/dev');
      expect(projectEnv().DATABASE_URL_LOCAL).toBe('postgres://project/local');
    });

    it('copies only the keys the generated server validates into it, never provider tokens', async () => {
      await setupProjectWithAuth();

      tmp.write(
        '.env',
        [
          'DATABASE_URL=postgres://project/main',
          'DATABASE_URL_DEV=postgres://project/dev',
          'DATABASE_URL_LOCAL=postgres://project/local',
          'VERCEL_TOKEN=vercel-token',
          'DENO_DEPLOY_TOKEN=deno-token',
          'CLOUDFLARE_API_TOKEN=cloudflare-token',
          'TYPEBASE_APP_URL_LOCAL=http://127.0.0.1:8080',
        ].join('\n') + '\n'
      );

      await withCwd(tmp.path, () => start.parseAsync([], { from: 'user' }));

      expect(Object.keys(serverEnv()).sort()).toEqual(['BETTER_AUTH_SECRET', 'DATABASE_URL']);
      expect(serverEnv().DATABASE_URL).toBe('postgres://project/local');
    });
  });
});
