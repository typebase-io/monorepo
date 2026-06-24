import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDenoProject } from '#helpers/deploy/deno/get-deno-project.ts';
import { getDenoToken } from '#helpers/deploy/deno/get-deno-token.ts';
import { addDenoEnvVar, getDenoEnvVar } from '#helpers/env/deno.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

vi.mock('#helpers/deploy/deno/get-deno-project.ts', () => ({ getDenoProject: vi.fn() }));
vi.mock('#helpers/deploy/deno/get-deno-token.ts', () => ({ getDenoToken: vi.fn() }));

interface DenoEnvBody {
  env_vars: { key: string; value: string; secret: boolean; contexts: string[] }[];
}

const parseBody = (body: string | undefined) => JSON.parse(body ?? '{}') as DenoEnvBody;

describe('deno env helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDenoToken).mockResolvedValue('deno-token');
    vi.mocked(getDenoProject).mockResolvedValue({ org: 'my-org', projectId: 'proj-1', slug: 'my-app' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the preview env var value with a string context', async () => {
    const { calls } = mockFetch(() => ({
      json: {
        env_vars: [
          { key: 'OTHER', value: 'other-value', contexts: 'preview' },
          { key: 'DATABASE_URL', value: 'prod-value', contexts: 'production' },
          { key: 'DATABASE_URL', value: 'preview-value', contexts: 'preview' },
        ],
      },
    }));

    await expect(getDenoEnvVar({ key: 'DATABASE_URL', target: 'dev' })).resolves.toBe('preview-value');

    expect(getDenoToken).toHaveBeenCalledOnce();
    expect(getDenoProject).toHaveBeenCalledWith('deno-token');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.deno.com/v2/apps/proj-1');
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer deno-token' });
  });

  it('returns ENCRYPTED for a production secret without a returned value', async () => {
    mockFetch(() => ({
      json: {
        env_vars: [{ key: 'DATABASE_URL', contexts: ['production'] }],
      },
    }));

    await expect(getDenoEnvVar({ key: 'DATABASE_URL', target: 'prod' })).resolves.toBe('ENCRYPTED');
  });

  it('returns undefined when the app has no matching env var', async () => {
    mockFetch(() => ({ json: {} }));

    await expect(getDenoEnvVar({ key: 'DATABASE_URL', target: 'prod' })).resolves.toBeUndefined();
  });

  it('throws when fetching the Deno Deploy app fails', async () => {
    mockFetch(() => ({ ok: false, status: 500, text: 'unavailable' }));

    await expect(getDenoEnvVar({ key: 'DATABASE_URL', target: 'dev' })).rejects.toThrow('Failed to fetch Deno Deploy app: unavailable');
  });

  it('sets a preview encrypted env var', async () => {
    const { calls } = mockFetch(() => ({}));

    await addDenoEnvVar({ key: 'SECRET_KEY', value: 'shh', encrypted: true, target: 'dev' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.deno.com/v2/apps/proj-1');
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer deno-token', 'Content-Type': 'application/json' });
    expect(parseBody(calls[0]?.body)).toEqual({
      env_vars: [{ key: 'SECRET_KEY', value: 'shh', secret: true, contexts: ['preview'] }],
    });
  });

  it('sets a production plain env var', async () => {
    const { calls } = mockFetch(() => ({}));

    await addDenoEnvVar({ key: 'PUBLIC_KEY', value: 'public', encrypted: false, target: 'prod' });

    expect(parseBody(calls[0]?.body)).toEqual({
      env_vars: [{ key: 'PUBLIC_KEY', value: 'public', secret: false, contexts: ['production'] }],
    });
  });

  it('throws when setting a Deno Deploy env var fails', async () => {
    mockFetch(() => ({ ok: false, status: 400, text: 'invalid env' }));

    await expect(addDenoEnvVar({ key: 'SECRET_KEY', value: 'shh', encrypted: true, target: 'prod' })).rejects.toThrow(
      'Failed to set Deno Deploy env var: invalid env'
    );
  });

  it('propagates project lookup errors without making a request', async () => {
    const { calls } = mockFetch(() => ({}));

    vi.mocked(getDenoProject).mockRejectedValue(new Error('project failed'));

    await expect(getDenoEnvVar({ key: 'DATABASE_URL', target: 'prod' })).rejects.toThrow('project failed');

    expect(calls).toHaveLength(0);
  });
});
