import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deploy } from '#helpers/deploy/deno/deploy.ts';
import { getDenoProject } from '#helpers/deploy/deno/get-deno-project.ts';
import { getDenoToken } from '#helpers/deploy/deno/get-deno-token.ts';
import { deno } from '#helpers/deploy/deno/index.ts';
import { waitForDeployment } from '#helpers/deploy/deno/wait-for-deployment.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

vi.mock('#helpers/deploy/deno/deploy.ts', () => ({ deploy: vi.fn() }));
vi.mock('#helpers/deploy/deno/get-deno-project.ts', () => ({ getDenoProject: vi.fn() }));
vi.mock('#helpers/deploy/deno/get-deno-token.ts', () => ({ getDenoToken: vi.fn() }));
vi.mock('#helpers/deploy/deno/wait-for-deployment.ts', () => ({ waitForDeployment: vi.fn() }));

interface EnvBody {
  env_vars: { key: string; value: string; secret: boolean; contexts: string[] }[];
}

describe('deno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDenoToken).mockResolvedValue('deno-token');
    vi.mocked(getDenoProject).mockResolvedValue({ org: 'my-org', projectId: 'proj-1', slug: 'my-app' });
    vi.mocked(deploy).mockResolvedValue({ revisionId: 'rev-1' });
    vi.mocked(waitForDeployment).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deploys to production and returns the stable url without touching env vars', async () => {
    const { calls } = mockFetch(() => ({ ok: true, json: {} }));

    const result = await deno({ serverDirPath: '/srv', target: 'prod', env: [] });

    expect(result).toEqual({ deploymentId: 'rev-1', url: 'https://my-app.my-org.deno.net' });
    expect(calls).toHaveLength(0);
    expect(deploy).toHaveBeenCalledWith({ token: 'deno-token', projectId: 'proj-1', serverDirPath: '/srv', target: 'prod' });
    expect(waitForDeployment).toHaveBeenCalledWith({ token: 'deno-token', revisionId: 'rev-1' });
  });

  it('sets preview env vars and returns the preview url for a dev deployment', async () => {
    const { calls } = mockFetch(() => ({ ok: true, json: {} }));

    const result = await deno({ serverDirPath: '/srv', target: 'dev', env: [{ key: 'FOO', value: 'bar', secret: true }] });

    expect(result).toEqual({ deploymentId: 'rev-1', url: 'https://my-app-rev-1.my-org.deno.net' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.deno.com/v2/apps/proj-1');
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.headers.Authorization).toBe('Bearer deno-token');

    const body = JSON.parse(calls[0]?.body ?? '{}') as EnvBody;

    expect(body.env_vars).toEqual([{ key: 'FOO', value: 'bar', secret: true, contexts: ['preview'] }]);
  });

  it('marks env vars as production for a prod deployment', async () => {
    const { calls } = mockFetch(() => ({ ok: true, json: {} }));

    await deno({ serverDirPath: '/srv', target: 'prod', env: [{ key: 'FOO', value: 'bar', secret: false }] });

    const body = JSON.parse(calls[0]?.body ?? '{}') as EnvBody;

    expect(body.env_vars[0]?.contexts).toEqual(['production']);
  });

  it('rejects when a deployment dependency throws', async () => {
    vi.mocked(deploy).mockRejectedValue(new Error('deployment failed'));

    await expect(deno({ serverDirPath: '/srv', target: 'prod', env: [] })).rejects.toThrow('deployment failed');

    expect(waitForDeployment).not.toHaveBeenCalled();
  });

  it('throws when setting env vars fails', async () => {
    mockFetch(() => ({ ok: false, text: 'forbidden' }));

    await expect(deno({ serverDirPath: '/srv', target: 'dev', env: [{ key: 'FOO', value: 'bar', secret: true }] })).rejects.toThrow(
      'Failed to set Deno Deploy env vars: forbidden'
    );

    expect(deploy).not.toHaveBeenCalled();
  });
});
