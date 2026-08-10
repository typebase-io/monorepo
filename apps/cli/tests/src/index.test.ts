import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spies = vi.hoisted(() => ({
  init: vi.fn(),
  codegen: vi.fn(),
  generateServer: vi.fn(),
  auth: vi.fn(),
  db: vi.fn(),
  deploy: vi.fn(),
  logs: vi.fn(),
  env: vi.fn(),
  config: vi.fn(),
  isTypebaseIoInstalled: vi.fn(),
}));

vi.mock('#commands/init.ts', async () => {
  const { Command } = await import('@commander-js/extra-typings');

  return { init: new Command('init').action(spies.init) };
});

vi.mock('#commands/codegen.ts', async () => {
  const { Command } = await import('@commander-js/extra-typings');

  return { codegen: new Command('codegen').action(spies.codegen) };
});

vi.mock('#commands/generate-server.ts', async () => {
  const { Command } = await import('@commander-js/extra-typings');

  return { generateServer: new Command('generate-server').action(spies.generateServer) };
});

vi.mock('#commands/auth.ts', async () => {
  const { Command } = await import('@commander-js/extra-typings');

  return { auth: new Command('auth').action(spies.auth) };
});

vi.mock('#commands/db.ts', async () => {
  const { Command } = await import('@commander-js/extra-typings');

  return { db: new Command('db').action(spies.db) };
});

vi.mock('#commands/deploy.ts', async () => {
  const { Command } = await import('@commander-js/extra-typings');

  return { deploy: new Command('deploy').action(spies.deploy) };
});

vi.mock('#commands/logs.ts', async () => {
  const { Command } = await import('@commander-js/extra-typings');

  return { logs: new Command('logs').action(spies.logs) };
});

vi.mock('#commands/env.ts', async () => {
  const { Command } = await import('@commander-js/extra-typings');

  return { env: new Command('env').action(spies.env) };
});

vi.mock('#commands/config.ts', async () => {
  const { Command } = await import('@commander-js/extra-typings');

  return { config: new Command('config').action(spies.config) };
});

vi.mock('#helpers/shared/is-typebase-io-installed.ts', () => {
  return { isTypebaseIoInstalled: spies.isTypebaseIoInstalled };
});

describe('cli entrypoint', () => {
  let originalArgv: string[];
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: MockInstance<typeof process.stderr.write>;

  const stderr = () => stderrSpy.mock.calls.flat().map(String).join('\n');

  const runCli = async (args: string[]) => {
    process.argv = ['node', 'typebase-io-cli', ...args];

    vi.resetModules();

    await import('../../src/index.ts');

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalled();
    });
  };

  beforeEach(() => {
    originalArgv = process.argv;

    vi.clearAllMocks();

    spies.isTypebaseIoInstalled.mockReturnValue(true);

    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it('runs a subcommand when typebase-io is installed', async () => {
    await runCli(['init']);

    expect(spies.isTypebaseIoInstalled).toHaveBeenCalled();
    expect(spies.init).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalled();
  });

  it.each(['env', 'logs', 'config'] as const)('runs the %s command without checking for the typebase-io install', async (command) => {
    spies.isTypebaseIoInstalled.mockReturnValue(false);

    await runCli([command]);

    expect(spies.isTypebaseIoInstalled).not.toHaveBeenCalled();
    expect(spies[command]).toHaveBeenCalledOnce();
    expect(stderr()).not.toContain('typebase-io');
  });

  it('blocks a subcommand that needs the package when typebase-io is missing', async () => {
    spies.isTypebaseIoInstalled.mockReturnValue(false);

    await runCli(['db']);

    expect(stderr()).toContain('`db` needs the `typebase-io` package, but it is not installed.');
  });

  it('reports an unexpected error and sets the exit code when a command throws', async () => {
    spies.init.mockImplementation(() => {
      throw new Error('boom');
    });

    await runCli(['init']);

    const errors = vi.mocked(console.error).mock.calls.flat().map(String).join('\n');

    expect(errors).toContain('Unexpected Error: Error: boom');
    expect(process.exitCode).toBe(1);
  });
});
