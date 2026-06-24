import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('getTypebaseConfig', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('returns defaults when no config file exists', async () => {
    const config = await withCwd(tmp.path, () => getTypebaseConfig());

    expect(config).toEqual({
      projectPath: 'typebase',
      serverProvider: undefined,
      server: {
        output: 'ts',
        adapter: 'node',
        skipLoadEnv: false,
        outDir: '_server',
        port: 8080,
      },
      vercel: undefined,
      cloudflare: undefined,
      deno: undefined,
      neon: undefined,
    });
  });

  it('defaults the project path to src/typebase when a src directory exists', async () => {
    tmp.mkdir('src');

    const config = await withCwd(tmp.path, () => getTypebaseConfig());

    expect(config.projectPath).toBe('src/typebase');
  });

  it('reads and applies values from typebase.json', async () => {
    tmp.write(
      'typebase.json',
      JSON.stringify({
        projectPath: 'backend',
        serverProvider: 'vercel',
        server: { output: 'esm', adapter: 'hono', port: 3000 },
      })
    );

    const config = await withCwd(tmp.path, () => getTypebaseConfig());

    expect(config).toEqual({
      projectPath: 'backend',
      serverProvider: 'vercel',
      server: {
        output: 'esm',
        adapter: 'hono',
        skipLoadEnv: false,
        outDir: '_server',
        port: 3000,
      },
      vercel: undefined,
      cloudflare: undefined,
      deno: undefined,
      neon: undefined,
    });
  });

  it('exits the process when the config is invalid', async () => {
    tmp.write('typebase.json', JSON.stringify({ server: { adapter: 'not-a-real-adapter' } }));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);

    await expect(withCwd(tmp.path, () => getTypebaseConfig())).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain('`typebase.json` is invalid.');
  });

  it('exits the process when the config is not valid JSON', async () => {
    tmp.write('typebase.json', '{ not json');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);

    await expect(withCwd(tmp.path, () => getTypebaseConfig())).rejects.toThrow('process.exit called');

    expect(errorSpy.mock.calls[0]?.[0]).toContain('`typebase.json` is invalid.');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('Invalid JSON');
  });
});
