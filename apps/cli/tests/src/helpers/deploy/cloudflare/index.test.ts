import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deploy } from '#helpers/deploy/cloudflare/deploy.ts';
import { enableWorkerSubdomain } from '#helpers/deploy/cloudflare/enable-worker-subdomain.ts';
import { getCloudflareToken } from '#helpers/deploy/cloudflare/get-cloudflare-token.ts';
import { getCloudflareWorker } from '#helpers/deploy/cloudflare/get-cloudflare-worker.ts';
import { cloudflare } from '#helpers/deploy/cloudflare/index.ts';

vi.mock('#helpers/deploy/cloudflare/deploy.ts', () => ({ deploy: vi.fn() }));
vi.mock('#helpers/deploy/cloudflare/enable-worker-subdomain.ts', () => ({ enableWorkerSubdomain: vi.fn() }));
vi.mock('#helpers/deploy/cloudflare/get-cloudflare-token.ts', () => ({ getCloudflareToken: vi.fn() }));
vi.mock('#helpers/deploy/cloudflare/get-cloudflare-worker.ts', () => ({ getCloudflareWorker: vi.fn() }));

const ENV = [{ key: 'FOO', value: 'bar', secret: true }];

describe('cloudflare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCloudflareToken).mockResolvedValue('cf-token');
    vi.mocked(getCloudflareWorker).mockResolvedValue({ accountId: 'acc-1', workerName: 'my-worker', subdomain: 'my-sub' });
    vi.mocked(deploy).mockResolvedValue({ deploymentId: 'dep-1' });
    vi.mocked(enableWorkerSubdomain).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deploys to the production worker name and returns the workers.dev url', async () => {
    const result = await cloudflare({ serverDirPath: '/srv', target: 'prod', env: ENV });

    expect(result).toEqual({ deploymentId: 'dep-1', url: 'https://my-worker.my-sub.workers.dev' });

    expect(deploy).toHaveBeenCalledWith({
      token: 'cf-token',
      accountId: 'acc-1',
      workerName: 'my-worker',
      serverDirPath: '/srv',
      env: ENV,
    });

    expect(enableWorkerSubdomain).toHaveBeenCalledWith({ token: 'cf-token', accountId: 'acc-1', workerName: 'my-worker' });
  });

  it('suffixes the worker name with -preview for the dev target', async () => {
    const result = await cloudflare({ serverDirPath: '/srv', target: 'dev', env: ENV });

    expect(result).toEqual({ deploymentId: 'dep-1', url: 'https://my-worker-preview.my-sub.workers.dev' });
    expect(deploy).toHaveBeenCalledWith(expect.objectContaining({ workerName: 'my-worker-preview' }));
    expect(enableWorkerSubdomain).toHaveBeenCalledWith(expect.objectContaining({ workerName: 'my-worker-preview' }));
  });

  const run = () => cloudflare({ serverDirPath: '/srv', target: 'prod', env: ENV });

  it('propagates a token error and skips the rest of the flow', async () => {
    vi.mocked(getCloudflareToken).mockRejectedValue(new Error('token failed'));

    await expect(run()).rejects.toThrow('token failed');

    expect(getCloudflareWorker).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
    expect(enableWorkerSubdomain).not.toHaveBeenCalled();
  });

  it('propagates a worker-resolution error and does not deploy', async () => {
    vi.mocked(getCloudflareWorker).mockRejectedValue(new Error('worker failed'));

    await expect(run()).rejects.toThrow('worker failed');

    expect(deploy).not.toHaveBeenCalled();
    expect(enableWorkerSubdomain).not.toHaveBeenCalled();
  });

  it('propagates a deploy error and does not enable the subdomain', async () => {
    vi.mocked(deploy).mockRejectedValue(new Error('deploy failed'));

    await expect(run()).rejects.toThrow('deploy failed');

    expect(enableWorkerSubdomain).not.toHaveBeenCalled();
  });

  it('propagates an error from enabling the worker subdomain', async () => {
    vi.mocked(enableWorkerSubdomain).mockRejectedValue(new Error('subdomain failed'));

    await expect(run()).rejects.toThrow('subdomain failed');
  });
});
