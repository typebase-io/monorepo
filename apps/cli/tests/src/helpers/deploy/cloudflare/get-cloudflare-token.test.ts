import { input } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCloudflareToken } from '#helpers/deploy/cloudflare/get-cloudflare-token.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('getCloudflareToken', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    delete process.env.CLOUDFLARE_API_TOKEN;

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(input).mockReset();
  });

  afterEach(() => {
    tmp.cleanup();

    delete process.env.CLOUDFLARE_API_TOKEN;

    vi.restoreAllMocks();
  });

  it('returns the token from the environment without prompting', async () => {
    tmp.write('.env', 'CLOUDFLARE_API_TOKEN=env-token\n');

    const token = await withCwd(tmp.path, () => getCloudflareToken());

    expect(token).toBe('env-token');
    expect(input).not.toHaveBeenCalled();
  });

  it('prompts for and persists the token when it is not set', async () => {
    vi.mocked(input).mockResolvedValue('pasted-token');

    const token = await withCwd(tmp.path, () => getCloudflareToken());

    expect(token).toBe('pasted-token');
    expect(input).toHaveBeenCalledOnce();
    expect(tmp.read('.env')).toContain('CLOUDFLARE_API_TOKEN=pasted-token');

    const validate = vi.mocked(input).mock.calls[0]?.[0].validate;

    expect(validate?.('   ')).toBe(false);
    expect(validate?.('a-token')).toBe(true);
  });
});
