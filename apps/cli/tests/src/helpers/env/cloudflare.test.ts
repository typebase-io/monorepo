import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCloudflareToken } from '#helpers/deploy/cloudflare/get-cloudflare-token.ts';
import { getCloudflareWorker } from '#helpers/deploy/cloudflare/get-cloudflare-worker.ts';
import { addCloudflareEnvVar, getCloudflareEnvVar } from '#helpers/env/cloudflare.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

vi.mock('#helpers/deploy/cloudflare/get-cloudflare-token.ts', () => ({ getCloudflareToken: vi.fn() }));
vi.mock('#helpers/deploy/cloudflare/get-cloudflare-worker.ts', () => ({ getCloudflareWorker: vi.fn() }));

const parseBody = (body: string | undefined) => JSON.parse(body ?? '{}') as Record<string, unknown>;

describe('cloudflare env helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCloudflareToken).mockResolvedValue('cf-token');
    vi.mocked(getCloudflareWorker).mockResolvedValue({ accountId: 'acc-1', workerName: 'my-worker', subdomain: 'my-sub' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns ENCRYPTED when a production secret exists', async () => {
    const { calls } = mockFetch(() => ({}));

    await expect(getCloudflareEnvVar({ key: 'DATABASE_URL', target: 'prod' })).resolves.toBe('ENCRYPTED');

    expect(getCloudflareToken).toHaveBeenCalledOnce();
    expect(getCloudflareWorker).toHaveBeenCalledWith('cf-token');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc-1/workers/scripts/my-worker/secrets/DATABASE_URL');
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer cf-token' });
  });

  it('returns undefined for a missing preview secret', async () => {
    const { calls } = mockFetch(() => ({ ok: false, status: 404, text: 'not found' }));

    await expect(getCloudflareEnvVar({ key: 'SECRET_KEY', target: 'dev' })).resolves.toBeUndefined();

    expect(calls[0]?.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc-1/workers/scripts/my-worker-preview/secrets/SECRET_KEY');
  });

  it('throws when fetching a Cloudflare secret fails', async () => {
    mockFetch(() => ({ ok: false, status: 500, text: 'forbidden' }));

    await expect(getCloudflareEnvVar({ key: 'SECRET_KEY', target: 'prod' })).rejects.toThrow('Failed to fetch Cloudflare secret: forbidden');
  });

  it('sets a preview secret with the Cloudflare secret payload', async () => {
    const { calls } = mockFetch(() => ({}));

    await addCloudflareEnvVar({ key: 'SECRET_KEY', value: 'shh', target: 'dev' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc-1/workers/scripts/my-worker-preview/secrets');
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer cf-token', 'Content-Type': 'application/json' });
    expect(parseBody(calls[0]?.body)).toEqual({ name: 'SECRET_KEY', text: 'shh', type: 'secret_text' });
  });

  it('throws when setting a production secret fails', async () => {
    const { calls } = mockFetch(() => ({ ok: false, status: 400, text: 'invalid secret' }));

    await expect(addCloudflareEnvVar({ key: 'SECRET_KEY', value: 'shh', target: 'prod' })).rejects.toThrow(
      'Failed to set Cloudflare secret: invalid secret'
    );

    expect(calls[0]?.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc-1/workers/scripts/my-worker/secrets');
  });

  it('propagates provider lookup errors without making a request', async () => {
    const { calls } = mockFetch(() => ({}));

    vi.mocked(getCloudflareWorker).mockRejectedValue(new Error('worker failed'));

    await expect(addCloudflareEnvVar({ key: 'SECRET_KEY', value: 'shh', target: 'prod' })).rejects.toThrow('worker failed');

    expect(calls).toHaveLength(0);
  });
});
