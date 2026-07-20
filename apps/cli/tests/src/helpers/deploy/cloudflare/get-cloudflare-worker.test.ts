import { input, select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCloudflareWorker } from '#helpers/deploy/cloudflare/get-cloudflare-worker.ts';

import { type MockFetchResult, mockFetch } from '#tests/helpers/mock-fetch.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const routeFetch = (responses: { accounts?: MockFetchResult; scripts?: MockFetchResult; subdomain?: MockFetchResult }) =>
  mockFetch((url) => {
    if (url.endsWith('/accounts')) return responses.accounts ?? {};

    if (url.endsWith('/workers/scripts')) return responses.scripts ?? {};

    if (url.endsWith('/workers/subdomain')) return responses.subdomain ?? {};

    return {};
  });

describe('getCloudflareWorker', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    vi.mocked(input).mockReset();
    vi.mocked(select).mockReset();
  });

  afterEach(() => {
    tmp.cleanup();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the saved cloudflare config without hitting the API', async () => {
    tmp.write('typebase.json', JSON.stringify({ cloudflare: { accountId: 'saved-acc', workerName: 'saved-worker', subdomain: 'saved-sub' } }));

    const { calls } = routeFetch({});

    const result = await withCwd(tmp.path, () => getCloudflareWorker('cf-token'));

    expect(result).toEqual({ accountId: 'saved-acc', workerName: 'saved-worker', subdomain: 'saved-sub' });
    expect(calls).toHaveLength(0);
  });

  it('selects an existing worker for a single account and persists the config', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('existing-worker');

    const { calls } = routeFetch({
      accounts: { json: { result: [{ id: 'acc-1', name: 'My Account' }] } },
      scripts: { json: { result: [{ id: 'existing-worker' }] } },
      subdomain: { json: { result: { subdomain: 'my-sub' } } },
    });

    const result = await withCwd(tmp.path, () => getCloudflareWorker('cf-token'));

    expect(result).toEqual({ accountId: 'acc-1', workerName: 'existing-worker', subdomain: 'my-sub' });

    expect(select).toHaveBeenCalledOnce();
    expect(input).not.toHaveBeenCalled();
    expect(calls.every((call) => call.headers.Authorization === 'Bearer cf-token')).toBe(true);

    expect((JSON.parse(tmp.read('typebase.json')) as { cloudflare: unknown }).cloudflare).toEqual({
      accountId: 'acc-1',
      workerName: 'existing-worker',
      subdomain: 'my-sub',
    });
  });

  it('prompts for an account and a new worker name when none exist', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('acc-2');
    vi.mocked(input).mockResolvedValue('brand-new-worker');

    routeFetch({
      accounts: {
        json: {
          result: [
            { id: 'acc-1', name: 'A1' },
            { id: 'acc-2', name: 'A2' },
          ],
        },
      },
      scripts: { json: { result: [] } },
      subdomain: { json: { result: { subdomain: 'sub-2' } } },
    });

    const result = await withCwd(tmp.path, () => getCloudflareWorker('cf-token'));

    expect(result).toEqual({ accountId: 'acc-2', workerName: 'brand-new-worker', subdomain: 'sub-2' });

    expect(select).toHaveBeenCalledOnce();
    expect(input).toHaveBeenCalledOnce();

    const validate = vi.mocked(input).mock.calls[0]?.[0].validate;

    expect(validate?.('   ')).toBe(false);
    expect(validate?.('ok')).toBe(true);
  });

  it('throws when fetching accounts fails', async () => {
    tmp.write('typebase.json', '{}');

    routeFetch({ accounts: { ok: false, text: 'unauthorized' } });

    await expect(withCwd(tmp.path, () => getCloudflareWorker('cf-token'))).rejects.toThrow('Failed to fetch Cloudflare accounts: unauthorized');
  });

  it('throws when the token has no accounts', async () => {
    tmp.write('typebase.json', '{}');

    routeFetch({ accounts: { json: { result: [] } } });

    await expect(withCwd(tmp.path, () => getCloudflareWorker('cf-token'))).rejects.toThrow('No Cloudflare accounts found for this token.');
  });

  it('throws when fetching workers fails', async () => {
    tmp.write('typebase.json', '{}');

    routeFetch({
      accounts: { json: { result: [{ id: 'acc-1', name: 'A1' }] } },
      scripts: { ok: false, text: 'boom' },
    });

    await expect(withCwd(tmp.path, () => getCloudflareWorker('cf-token'))).rejects.toThrow('Failed to fetch Cloudflare workers: boom');
  });

  it('throws when fetching the subdomain fails', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('existing-worker');

    routeFetch({
      accounts: { json: { result: [{ id: 'acc-1', name: 'A1' }] } },
      scripts: { json: { result: [{ id: 'existing-worker' }] } },
      subdomain: { ok: false, text: 'no subdomain' },
    });

    await expect(withCwd(tmp.path, () => getCloudflareWorker('cf-token'))).rejects.toThrow('Failed to fetch Cloudflare subdomain: no subdomain');
  });
});
