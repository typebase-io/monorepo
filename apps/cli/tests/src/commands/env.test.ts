import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '#commands/env.ts';

import { addCloudflareEnvVar, getCloudflareEnvVar } from '#helpers/env/cloudflare.ts';
import { addDenoEnvVar, getDenoEnvVar } from '#helpers/env/deno.ts';
import { addVercelEnvVar, getVercelEnvVar } from '#helpers/env/vercel.ts';
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

vi.mock('#helpers/env/vercel.ts', () => ({ getVercelEnvVar: vi.fn(), addVercelEnvVar: vi.fn() }));
vi.mock('#helpers/env/deno.ts', () => ({ getDenoEnvVar: vi.fn(), addDenoEnvVar: vi.fn() }));
vi.mock('#helpers/env/cloudflare.ts', () => ({ getCloudflareEnvVar: vi.fn(), addCloudflareEnvVar: vi.fn() }));
vi.mock('#helpers/shared/get-typebase-config.ts', async (o) => passThrough(await o<Record<string, unknown>>()));

const logged = () => vi.mocked(console.log).mock.calls.flat().map(String).join('\n');

describe('env command', () => {
  let tmp: TempDir;

  beforeEach(() => {
    vi.clearAllMocks();

    tmp = createTempDir();

    vi.mocked(getVercelEnvVar).mockResolvedValue(undefined);
    vi.mocked(getDenoEnvVar).mockResolvedValue(undefined);
    vi.mocked(getCloudflareEnvVar).mockResolvedValue(undefined);
    vi.mocked(addVercelEnvVar).mockResolvedValue(undefined);
    vi.mocked(addDenoEnvVar).mockResolvedValue(undefined);
    vi.mocked(addCloudflareEnvVar).mockResolvedValue(undefined);

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    tmp.cleanup();
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('reads from the provider passed with --provider and prints the value', async () => {
      vi.mocked(getVercelEnvVar).mockResolvedValue('prod-value');

      await withCwd(tmp.path, () => env.parseAsync(['prod', 'get', 'DATABASE_URL', '--provider', 'vercel'], { from: 'user' }));

      expect(getVercelEnvVar).toHaveBeenCalledWith({ key: 'DATABASE_URL', target: 'prod' });
      expect(getDenoEnvVar).not.toHaveBeenCalled();
      expect(getCloudflareEnvVar).not.toHaveBeenCalled();
      expect(logged()).toContain('prod-value');
      expect(select).not.toHaveBeenCalled();
    });

    it('routes to the deno helper', async () => {
      vi.mocked(getDenoEnvVar).mockResolvedValue('deno-value');

      await withCwd(tmp.path, () => env.parseAsync(['dev', 'get', 'KEY', '--provider', 'deno'], { from: 'user' }));

      expect(getDenoEnvVar).toHaveBeenCalledWith({ key: 'KEY', target: 'dev' });
      expect(logged()).toContain('deno-value');
    });

    it('routes to the cloudflare helper', async () => {
      vi.mocked(getCloudflareEnvVar).mockResolvedValue('ENCRYPTED');

      await withCwd(tmp.path, () => env.parseAsync(['dev', 'get', 'KEY', '--provider', 'cloudflare'], { from: 'user' }));

      expect(getCloudflareEnvVar).toHaveBeenCalledWith({ key: 'KEY', target: 'dev' });
      expect(logged()).toContain('ENCRYPTED');
    });

    it('passes the dev target for the dev subcommand', async () => {
      await withCwd(tmp.path, () => env.parseAsync(['dev', 'get', 'KEY', '--provider', 'vercel'], { from: 'user' }));

      expect(getVercelEnvVar).toHaveBeenCalledWith({ key: 'KEY', target: 'dev' });
    });

    it('reports when the variable is not found', async () => {
      vi.mocked(getVercelEnvVar).mockResolvedValue(undefined);

      await withCwd(tmp.path, () => env.parseAsync(['prod', 'get', 'MISSING', '--provider', 'vercel'], { from: 'user' }));

      expect(logged()).toContain('Environment variable "MISSING" not found.');
    });

    it('prints an empty value without reporting it as missing', async () => {
      vi.mocked(getVercelEnvVar).mockResolvedValue('');

      await withCwd(tmp.path, () => env.parseAsync(['prod', 'get', 'EMPTY', '--provider', 'vercel'], { from: 'user' }));

      expect(logged()).not.toContain('not found');
    });

    it('falls back to the serverProvider from typebase.json when no --provider is given', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'deno' }));

      vi.mocked(getDenoEnvVar).mockResolvedValue('from-config');

      await withCwd(tmp.path, () => env.parseAsync(['prod', 'get', 'KEY'], { from: 'user' }));

      expect(select).not.toHaveBeenCalled();
      expect(getDenoEnvVar).toHaveBeenCalledWith({ key: 'KEY', target: 'prod' });
      expect(logged()).toContain('from-config');
    });

    it('prompts for a provider when none is configured', async () => {
      vi.mocked(select).mockResolvedValue('cloudflare');
      vi.mocked(getCloudflareEnvVar).mockResolvedValue('picked');

      await withCwd(tmp.path, () => env.parseAsync(['prod', 'get', 'KEY'], { from: 'user' }));

      expect(select).toHaveBeenCalledOnce();
      expect(getCloudflareEnvVar).toHaveBeenCalledWith({ key: 'KEY', target: 'prod' });
      expect(logged()).toContain('picked');
    });

    it('prefers the explicit --provider over the configured serverProvider', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'deno' }));

      vi.mocked(getVercelEnvVar).mockResolvedValue('vercel-value');

      await withCwd(tmp.path, () => env.parseAsync(['prod', 'get', 'KEY', '--provider', 'vercel'], { from: 'user' }));

      expect(getVercelEnvVar).toHaveBeenCalledWith({ key: 'KEY', target: 'prod' });
      expect(getDenoEnvVar).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('adds an encrypted value through vercel by default', async () => {
      await withCwd(tmp.path, () => env.parseAsync(['prod', 'add', 'KEY', 'value', '--provider', 'vercel'], { from: 'user' }));

      expect(addVercelEnvVar).toHaveBeenCalledWith({ key: 'KEY', value: 'value', encrypted: true, target: 'prod' });
      expect(logged()).toContain('Environment variable "KEY" set for prod.');
    });

    it('stores the value unencrypted when --no-encrypted is passed', async () => {
      await withCwd(tmp.path, () => env.parseAsync(['dev', 'add', 'KEY', 'value', '--provider', 'vercel', '--no-encrypted'], { from: 'user' }));

      expect(addVercelEnvVar).toHaveBeenCalledWith({ key: 'KEY', value: 'value', encrypted: false, target: 'dev' });
    });

    it('forwards the encrypted flag to the deno helper', async () => {
      await withCwd(tmp.path, () => env.parseAsync(['dev', 'add', 'KEY', 'value', '--provider', 'deno', '--no-encrypted'], { from: 'user' }));

      expect(addDenoEnvVar).toHaveBeenCalledWith({ key: 'KEY', value: 'value', encrypted: false, target: 'dev' });
    });

    it('adds through cloudflare without an encrypted flag', async () => {
      await withCwd(tmp.path, () => env.parseAsync(['prod', 'add', 'KEY', 'value', '--provider', 'cloudflare'], { from: 'user' }));

      expect(addCloudflareEnvVar).toHaveBeenCalledWith({ key: 'KEY', value: 'value', target: 'prod' });
      expect(logged()).toContain('Environment variable "KEY" set for prod.');
    });

    it('falls back to the serverProvider from typebase.json', async () => {
      tmp.write('typebase.json', JSON.stringify({ serverProvider: 'deno' }));

      await withCwd(tmp.path, () => env.parseAsync(['dev', 'add', 'KEY', 'value'], { from: 'user' }));

      expect(select).not.toHaveBeenCalled();
      expect(addDenoEnvVar).toHaveBeenCalledWith({ key: 'KEY', value: 'value', encrypted: true, target: 'dev' });
    });

    it('prompts for a provider when none is configured', async () => {
      vi.mocked(select).mockResolvedValue('vercel');

      await withCwd(tmp.path, () => env.parseAsync(['dev', 'add', 'KEY', 'value'], { from: 'user' }));

      expect(select).toHaveBeenCalledOnce();
      expect(addVercelEnvVar).toHaveBeenCalledWith({ key: 'KEY', value: 'value', encrypted: true, target: 'dev' });
    });
  });

  describe('propagates failures', () => {
    it('rejects when getTypebaseConfig throws', async () => {
      vi.mocked(getTypebaseConfig).mockRejectedValueOnce(new Error('boom'));

      await expect(withCwd(tmp.path, () => env.parseAsync(['prod', 'get', 'KEY', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow('boom');
    });

    it('rejects when the get helper throws', async () => {
      vi.mocked(getVercelEnvVar).mockRejectedValueOnce(new Error('boom'));

      await expect(withCwd(tmp.path, () => env.parseAsync(['prod', 'get', 'KEY', '--provider', 'vercel'], { from: 'user' }))).rejects.toThrow('boom');
    });

    it('rejects when the add helper throws', async () => {
      vi.mocked(addVercelEnvVar).mockRejectedValueOnce(new Error('boom'));

      await expect(
        withCwd(tmp.path, () => env.parseAsync(['prod', 'add', 'KEY', 'value', '--provider', 'vercel'], { from: 'user' }))
      ).rejects.toThrow('boom');
    });
  });
});
