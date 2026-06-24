import { input } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getNeonToken } from '#helpers/db/neon/get-neon-token.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('getNeonToken', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    delete process.env.NEON_API_KEY;

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(input).mockReset();
  });

  afterEach(() => {
    tmp.cleanup();

    delete process.env.NEON_API_KEY;

    vi.restoreAllMocks();
  });

  it('returns the token from the environment without prompting', async () => {
    process.env.NEON_API_KEY = 'process-token';
    tmp.write('.env', 'NEON_API_KEY=file-token\n');

    const token = await withCwd(tmp.path, () => getNeonToken());

    expect(token).toBe('process-token');
    expect(input).not.toHaveBeenCalled();
    expect(tmp.read('.env')).toBe('NEON_API_KEY=file-token\n');
  });

  it('returns the token from .env without prompting', async () => {
    tmp.write('.env', 'NEON_API_KEY=file-token\n');

    const token = await withCwd(tmp.path, () => getNeonToken());

    expect(token).toBe('file-token');
    expect(input).not.toHaveBeenCalled();
  });

  it('prompts for and persists the token when it is not set', async () => {
    vi.mocked(input).mockResolvedValue('pasted-token');

    const token = await withCwd(tmp.path, () => getNeonToken());

    expect(token).toBe('pasted-token');
    expect(input).toHaveBeenCalledOnce();
    expect(vi.mocked(input).mock.calls[0]?.[0].message).toBe('Paste your Neon API key: ');
    expect(vi.mocked(input).mock.calls[0]?.[0].required).toBe(true);
    expect(tmp.read('.env')).toContain('NEON_API_KEY=pasted-token');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No Neon API key found. Create one at:'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('https://console.neon.tech/app/settings/api-keys'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Token saved to .env'));

    const validate = vi.mocked(input).mock.calls[0]?.[0].validate;

    expect(validate?.('   ')).toBe(false);
    expect(validate?.('neon-token')).toBe(true);
  });
});
