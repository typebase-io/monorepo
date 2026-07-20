import { input, select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDenoProject } from '#helpers/deploy/deno/get-deno-project.ts';

import { type MockFetchResult, mockFetch } from '#tests/helpers/mock-fetch.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const routeFetch = (responses: { listApps?: (url: string) => MockFetchResult; createApp?: MockFetchResult }) =>
  mockFetch((url, init) => {
    if (init?.method === 'POST') return responses.createApp ?? {};

    return responses.listApps?.(url) ?? { json: [] };
  });

describe('getDenoProject', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    vi.clearAllMocks();

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.mocked(input).mockImplementation((options: { message: string }) =>
      Promise.resolve(options.message.includes('organization') ? 'my-org' : 'fresh-app')
    );

    vi.mocked(select).mockReset();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the saved deno config without hitting the API', async () => {
    tmp.write('typebase.json', JSON.stringify({ deno: { org: 'saved-org', projectId: 'saved-id', slug: 'saved-slug' } }));

    const { calls } = routeFetch({});

    const result = await withCwd(tmp.path, () => getDenoProject('deno-token'));

    expect(result).toEqual({ org: 'saved-org', projectId: 'saved-id', slug: 'saved-slug' });
    expect(calls).toHaveLength(0);
  });

  it('selects an existing app and saves the config', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('app-1');

    routeFetch({ listApps: () => ({ json: [{ id: 'app-1', slug: 'my-app' }] }) });

    const result = await withCwd(tmp.path, () => getDenoProject('deno-token'));

    expect(result).toEqual({ org: 'my-org', projectId: 'app-1', slug: 'my-app' });
    expect((JSON.parse(tmp.read('typebase.json')) as { deno: unknown }).deno).toEqual({ org: 'my-org', projectId: 'app-1', slug: 'my-app' });
  });

  it('paginates through apps using the link header cursor', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('app-2');

    routeFetch({
      listApps: (url) =>
        url.includes('cursor=NEXT')
          ? { json: [{ id: 'app-2', slug: 'app-two' }] }
          : { json: [{ id: 'app-1', slug: 'app-one' }], headers: { link: '<https://api.deno.com/v2/apps?cursor=NEXT>; rel="next"' } },
    });

    const result = await withCwd(tmp.path, () => getDenoProject('deno-token'));

    expect(result).toEqual({ org: 'my-org', projectId: 'app-2', slug: 'app-two' });
  });

  it('creates a new app when none exist', async () => {
    tmp.write('typebase.json', '{}');

    routeFetch({ listApps: () => ({ json: [] }), createApp: { json: { id: 'created-id', slug: 'fresh-app' } } });

    const result = await withCwd(tmp.path, () => getDenoProject('deno-token'));

    expect(result).toEqual({ org: 'my-org', projectId: 'created-id', slug: 'fresh-app' });
    expect(select).not.toHaveBeenCalled();

    const orgValidate = vi.mocked(input).mock.calls[0]?.[0].validate;
    const slugValidate = vi.mocked(input).mock.calls[1]?.[0].validate;

    expect(orgValidate?.('   ')).toBe(false);
    expect(orgValidate?.('org')).toBe(true);
    expect(slugValidate?.('   ')).toBe(false);
    expect(slugValidate?.('app')).toBe(true);
  });

  it('throws when fetching apps fails', async () => {
    tmp.write('typebase.json', '{}');

    routeFetch({ listApps: () => ({ ok: false, text: 'bad token' }) });

    await expect(withCwd(tmp.path, () => getDenoProject('deno-token'))).rejects.toThrow('Failed to fetch Deno Deploy apps: bad token');
  });

  it('throws when creating an app fails', async () => {
    tmp.write('typebase.json', '{}');

    routeFetch({ listApps: () => ({ json: [] }), createApp: { ok: false, text: 'name taken' } });

    await expect(withCwd(tmp.path, () => getDenoProject('deno-token'))).rejects.toThrow('Failed to create Deno Deploy app: name taken');
  });

  it('exits when the selected app cannot be resolved', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('does-not-exist');

    routeFetch({ listApps: () => ({ json: [{ id: 'app-1', slug: 'my-app' }] }) });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);

    await expect(withCwd(tmp.path, () => getDenoProject('deno-token'))).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
