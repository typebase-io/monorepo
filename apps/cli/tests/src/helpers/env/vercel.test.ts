import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getVercelProject } from '#helpers/deploy/vercel/get-vercel-project.ts';
import { getVercelToken } from '#helpers/deploy/vercel/get-vercel-token.ts';
import { addVercelEnvVar, getVercelEnvVar } from '#helpers/env/vercel.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

vi.mock('#helpers/deploy/vercel/get-vercel-project.ts', () => ({ getVercelProject: vi.fn() }));
vi.mock('#helpers/deploy/vercel/get-vercel-token.ts', () => ({ getVercelToken: vi.fn() }));

const parseBody = (body: string | undefined) => JSON.parse(body ?? '{}') as Record<string, unknown>;

describe('vercel env helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVercelToken).mockResolvedValue('vercel-token');
    vi.mocked(getVercelProject).mockResolvedValue({ projectId: 'prj_1', projectName: 'my-project', orgId: 'team-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the matching Vercel preview env var value', async () => {
    const { calls } = mockFetch(() => ({
      json: {
        envs: [
          { key: 'OTHER', target: 'preview', value: 'other' },
          { key: 'DATABASE_URL', target: 'production', value: 'prod-value' },
          { key: 'DATABASE_URL', target: ['development', 'preview'], value: 'preview-value' },
        ],
      },
    }));

    await expect(getVercelEnvVar({ key: 'DATABASE_URL', target: 'dev' })).resolves.toBe('preview-value');

    expect(getVercelToken).toHaveBeenCalledOnce();
    expect(getVercelProject).toHaveBeenCalledWith('vercel-token');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.vercel.com/v10/projects/prj_1/env?decrypt=true&teamId=team-1');
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer vercel-token', 'Content-Type': 'application/json' });
  });

  it('returns undefined when Vercel has no matching production env var', async () => {
    vi.mocked(getVercelProject).mockResolvedValue({ projectId: 'prj_1', projectName: 'my-project', orgId: undefined });

    const { calls } = mockFetch(() => ({ json: { envs: [] } }));

    await expect(getVercelEnvVar({ key: 'DATABASE_URL', target: 'prod' })).resolves.toBeUndefined();

    expect(calls[0]?.url).toBe('https://api.vercel.com/v10/projects/prj_1/env?decrypt=true');
  });

  it('throws when reading a Vercel env var fails', async () => {
    mockFetch(() => ({ ok: false, status: 500, text: 'env unavailable' }));

    await expect(getVercelEnvVar({ key: 'DATABASE_URL', target: 'prod' })).rejects.toThrow('env unavailable');
  });

  it('adds an encrypted preview env var with team scoping', async () => {
    const { calls } = mockFetch(() => ({}));

    await addVercelEnvVar({ key: 'SECRET_KEY', value: 'shh', encrypted: true, target: 'dev' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.vercel.com/v10/projects/prj_1/env?upsert=true&teamId=team-1');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer vercel-token', 'Content-Type': 'application/json' });
    expect(parseBody(calls[0]?.body)).toEqual({
      key: 'SECRET_KEY',
      value: 'shh',
      type: 'encrypted',
      target: ['development', 'preview'],
    });
  });

  it('adds a plain production env var without team scoping', async () => {
    vi.mocked(getVercelProject).mockResolvedValue({ projectId: 'prj_1', projectName: 'my-project', orgId: undefined });

    const { calls } = mockFetch(() => ({}));

    await addVercelEnvVar({ key: 'PUBLIC_KEY', value: 'public', encrypted: false, target: 'prod' });

    expect(calls[0]?.url).toBe('https://api.vercel.com/v10/projects/prj_1/env?upsert=true');
    expect(parseBody(calls[0]?.body)).toEqual({
      key: 'PUBLIC_KEY',
      value: 'public',
      type: 'plain',
      target: ['production'],
    });
  });

  it('throws when adding a Vercel env var fails', async () => {
    mockFetch(() => ({ ok: false, status: 400, text: 'env rejected' }));

    await expect(addVercelEnvVar({ key: 'SECRET_KEY', value: 'shh', encrypted: true, target: 'prod' })).rejects.toThrow('env rejected');
  });

  it('propagates project lookup errors without making a request', async () => {
    const { calls } = mockFetch(() => ({}));

    vi.mocked(getVercelProject).mockRejectedValue(new Error('project failed'));

    await expect(getVercelEnvVar({ key: 'DATABASE_URL', target: 'prod' })).rejects.toThrow('project failed');

    expect(calls).toHaveLength(0);
  });
});
