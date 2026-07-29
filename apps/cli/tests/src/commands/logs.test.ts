import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logs } from '#commands/logs.ts';

import { streamLogs } from '#helpers/logs/stream-logs.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const { passThrough } = vi.hoisted(() => ({
  passThrough: (actual: Record<string, unknown>): Record<string, unknown> => {
    const mocked = { ...actual };

    for (const [key, value] of Object.entries(actual)) {
      if (typeof value === 'function') mocked[key] = vi.fn(value as (...args: unknown[]) => unknown);
    }

    return mocked;
  },
}));

vi.mock('#helpers/logs/stream-logs.ts', () => ({ streamLogs: vi.fn() }));
vi.mock('#helpers/shared/get-typebase-config.ts', async (o) => passThrough(await o<Record<string, unknown>>()));

describe('logs command', () => {
  let tmp: TempDir;

  beforeEach(() => {
    vi.clearAllMocks();

    tmp = createTempDir();

    vi.mocked(streamLogs).mockResolvedValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it.each(['vercel', 'deno', 'cloudflare'] as const)('streams %s logs for the target passed with --provider', async (provider) => {
    await withCwd(tmp.path, () => logs.parseAsync(['prod', '--provider', provider], { from: 'user' }));

    expect(streamLogs).toHaveBeenCalledWith({ target: 'prod', provider });
    expect(select).not.toHaveBeenCalled();
  });

  it('passes the dev target', async () => {
    await withCwd(tmp.path, () => logs.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

    expect(streamLogs).toHaveBeenCalledWith({ target: 'dev', provider: 'vercel' });
  });

  it('falls back to the serverProvider from typebase.json when no --provider is given', async () => {
    tmp.write('typebase.json', JSON.stringify({ serverProvider: 'deno' }));

    await withCwd(tmp.path, () => logs.parseAsync(['dev'], { from: 'user' }));

    expect(select).not.toHaveBeenCalled();
    expect(streamLogs).toHaveBeenCalledWith({ target: 'dev', provider: 'deno' });
  });

  it('prompts for a provider when none is configured', async () => {
    vi.mocked(select).mockResolvedValue('vercel');

    await withCwd(tmp.path, () => logs.parseAsync(['prod'], { from: 'user' }));

    expect(select).toHaveBeenCalledOnce();
    expect(streamLogs).toHaveBeenCalledWith({ target: 'prod', provider: 'vercel' });
  });

  it('prefers the explicit --provider over the configured serverProvider', async () => {
    tmp.write('typebase.json', JSON.stringify({ serverProvider: 'deno' }));

    await withCwd(tmp.path, () => logs.parseAsync(['dev', '--provider', 'vercel'], { from: 'user' }));

    expect(streamLogs).toHaveBeenCalledWith({ target: 'dev', provider: 'vercel' });
    expect(select).not.toHaveBeenCalled();
  });

  it('rejects a target other than dev or prod', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await expect(withCwd(tmp.path, () => logs.parseAsync(['staging', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow(
      'process.exit called'
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(streamLogs).not.toHaveBeenCalled();
  });

  it('rejects when getTypebaseConfig throws', async () => {
    vi.mocked(getTypebaseConfig).mockRejectedValueOnce(new Error('boom'));

    await expect(withCwd(tmp.path, () => logs.parseAsync(['prod', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow('boom');
  });

  it('rejects when the stream fails', async () => {
    vi.mocked(streamLogs).mockRejectedValueOnce(new Error('boom'));

    await expect(withCwd(tmp.path, () => logs.parseAsync(['prod', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow('boom');
  });
});
