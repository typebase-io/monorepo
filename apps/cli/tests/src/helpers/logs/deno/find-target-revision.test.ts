import { afterEach, describe, expect, it, vi } from 'vitest';

import { findTargetRevision } from '#helpers/logs/deno/find-target-revision.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

const isRevisionsList = (url: string) => url.includes('/revisions?');

const mockRevisionsApi = () =>
  mockFetch((url) => {
    if (isRevisionsList(url)) {
      return { json: [{ id: 'rev_prod' }, { id: 'rev_dev' }] };
    }

    return { json: url.includes('rev_prod') ? [{ slug: 'production' }, { slug: 'preview' }] : [{ slug: 'preview' }] };
  });

describe('findTargetRevision', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the newest revision on the production timeline for the prod target', async () => {
    const { calls } = mockRevisionsApi();

    await expect(findTargetRevision({ token: 'deno-token', projectId: 'app-1', target: 'prod' })).resolves.toBe('rev_prod');

    expect(calls[0]?.url).toBe('https://api.deno.com/v2/apps/app-1/revisions?status=succeeded&limit=30');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer deno-token' });
    expect(calls[1]?.url).toBe('https://api.deno.com/v2/revisions/rev_prod/timelines');
    expect(calls[1]?.headers).toEqual({ Authorization: 'Bearer deno-token' });
    expect(calls).toHaveLength(2);
  });

  it('returns the newest revision without a production timeline for the dev target', async () => {
    const { calls } = mockRevisionsApi();

    await expect(findTargetRevision({ token: 'deno-token', projectId: 'app-1', target: 'dev' })).resolves.toBe('rev_dev');

    expect(calls[1]?.url).toBe('https://api.deno.com/v2/revisions/rev_prod/timelines');
    expect(calls[2]?.url).toBe('https://api.deno.com/v2/revisions/rev_dev/timelines');
  });

  it('returns undefined when no revision matches the target', async () => {
    mockFetch((url) => {
      if (isRevisionsList(url)) {
        return { json: [{ id: 'rev_prod' }] };
      }

      return { json: [{ slug: 'production' }, { slug: 'preview' }] };
    });

    await expect(findTargetRevision({ token: 'deno-token', projectId: 'app-1', target: 'dev' })).resolves.toBeUndefined();
  });

  it('throws when listing revisions fails', async () => {
    mockFetch(() => ({ ok: false, text: 'revisions unavailable' }));

    await expect(findTargetRevision({ token: 'deno-token', projectId: 'app-1', target: 'prod' })).rejects.toThrow('revisions unavailable');
  });

  it('throws when fetching timelines fails', async () => {
    mockFetch((url) => {
      if (isRevisionsList(url)) {
        return { json: [{ id: 'rev_prod' }] };
      }

      return { ok: false, text: 'timelines unavailable' };
    });

    await expect(findTargetRevision({ token: 'deno-token', projectId: 'app-1', target: 'prod' })).rejects.toThrow('timelines unavailable');
  });
});
