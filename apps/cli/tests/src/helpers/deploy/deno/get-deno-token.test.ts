import { input } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDenoToken } from '#helpers/deploy/deno/get-deno-token.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('getDenoToken', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    delete process.env.DENO_DEPLOY_TOKEN;

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(input).mockReset();
  });

  afterEach(() => {
    tmp.cleanup();

    delete process.env.DENO_DEPLOY_TOKEN;

    vi.restoreAllMocks();
  });

  it('returns the token from the environment without prompting', async () => {
    tmp.write('.env', 'DENO_DEPLOY_TOKEN=env-token\n');

    const token = await withCwd(tmp.path, () => getDenoToken());

    expect(token).toBe('env-token');
    expect(input).not.toHaveBeenCalled();
  });

  it('prompts for and persists the token when it is not set', async () => {
    vi.mocked(input).mockResolvedValue('pasted-token');

    const token = await withCwd(tmp.path, () => getDenoToken());

    expect(token).toBe('pasted-token');
    expect(input).toHaveBeenCalledOnce();
    expect(tmp.read('.env')).toContain('DENO_DEPLOY_TOKEN=pasted-token');

    const validate = vi.mocked(input).mock.calls[0]?.[0].validate;

    expect(validate?.('   ')).toBe(false);
    expect(validate?.('a-token')).toBe(true);
  });
});
