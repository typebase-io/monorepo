import { afterEach, describe, expect, it, vi } from 'vitest';

import { assignAlias } from '#helpers/deploy/vercel/assign-alias.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

describe('assignAlias', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('assigns a stable alias for the deployment and returns it', async () => {
    const { calls } = mockFetch(() => ({}));

    const alias = await assignAlias({
      token: 'vercel-token',
      deploymentId: 'dpl_123',
      projectId: 'proj_with_underscores',
      orgId: 'team-1',
      target: 'prod',
    });

    expect(alias).toBe('proj-with-underscores-prod.vercel.app');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.vercel.com/v2/deployments/dpl_123/aliases?teamId=team-1');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers.Authorization).toBe('Bearer vercel-token');
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ alias });
  });

  it('uses the correct target for the alias', async () => {
    mockFetch(() => ({}));

    const alias = await assignAlias({
      token: 'vercel-token',
      deploymentId: 'dpl_123',
      projectId: 'somethingelse',
      orgId: 'team-1',
      target: 'dev',
    });

    expect(alias).toBe('somethingelse-dev.vercel.app');
  });

  it('propagates alias assignment errors', async () => {
    mockFetch(() => ({ ok: false, text: 'alias rejected' }));

    await expect(
      assignAlias({
        token: 'vercel-token',
        deploymentId: 'dpl_123',
        projectId: 'my-project',
        orgId: undefined,
        target: 'dev',
      })
    ).rejects.toThrow('alias rejected');
  });
});
