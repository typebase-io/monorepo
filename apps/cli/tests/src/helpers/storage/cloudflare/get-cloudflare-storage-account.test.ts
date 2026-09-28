import { select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudflareClient } from '#helpers/deploy/cloudflare/client.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { getCloudflareStorageAccount } from '#helpers/storage/cloudflare/get-cloudflare-storage-account.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const accounts = vi.hoisted(() => ({ list: [] as { id: string; name: string }[] }));

vi.mock('#helpers/deploy/cloudflare/client.ts', () => ({
  CloudflareClient: vi.fn(function () {
    return { listAccounts: vi.fn(() => Promise.resolve(accounts.list)) };
  }),
}));

describe('getCloudflareStorageAccount', () => {
  let tmp: TempDir;

  const getAccount = (config: Record<string, unknown>) => {
    tmp.write('typebase.json', JSON.stringify(config));

    return withCwd(tmp.path, async () => getCloudflareStorageAccount({ token: 'cloudflare-token', config: await getTypebaseConfig() }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(select).mockReset();

    tmp = createTempDir();

    accounts.list = [
      { id: 'acc_acme', name: 'Acme' },
      { id: 'acc_beta', name: 'Beta' },
    ];
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('reads the saved account without asking or reaching Cloudflare', async () => {
    await expect(getAccount({ storage: { cloudflare: { accountId: 'acc_saved' } } })).resolves.toEqual({ accountId: 'acc_saved', isNew: false });

    expect(CloudflareClient).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it('asks which account to keep the R2 buckets in when none is saved', async () => {
    vi.mocked(select).mockResolvedValue('acc_beta');

    await expect(getAccount({})).resolves.toEqual({ accountId: 'acc_beta', isNew: true });

    expect(CloudflareClient).toHaveBeenCalledWith({ token: 'cloudflare-token', accountId: undefined });
    expect(select).toHaveBeenCalledWith({
      message: 'Select the Cloudflare account that holds your R2 buckets:',
      choices: [
        { name: 'Acme', value: 'acc_acme' },
        { name: 'Beta', value: 'acc_beta' },
      ],
    });
  });

  it('fails without asking when the token reaches no account', async () => {
    accounts.list = [];

    await expect(getAccount({})).rejects.toThrow(
      'Your Cloudflare token cannot reach any account to keep R2 buckets in. Create a token with access to an account, then sync again.'
    );

    expect(select).not.toHaveBeenCalled();
  });
});
