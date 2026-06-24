import { confirm, input, select } from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getVercelProject } from '#helpers/deploy/vercel/get-vercel-project.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

const projectsResponse = (projects: unknown[]) => ({ json: { projects } });

describe('getVercelProject', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(confirm).mockReset();
    vi.mocked(input).mockReset();
    vi.mocked(select).mockReset();
  });

  afterEach(() => {
    tmp.cleanup();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the saved vercel config without hitting the API', async () => {
    tmp.write('typebase.json', JSON.stringify({ vercel: { projectId: 'saved-id', projectName: 'saved-name', orgId: 'saved-org' } }));

    const { calls } = mockFetch(() => ({}));

    const result = await withCwd(tmp.path, () => getVercelProject('vercel-token'));

    expect(result).toEqual({ projectId: 'saved-id', projectName: 'saved-name', orgId: 'saved-org' });
    expect(calls).toHaveLength(0);
  });

  it('creates a new project when none exist and saves it', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(input).mockResolvedValue('fresh-project');

    const { calls } = mockFetch((url, init) => {
      if (url.startsWith('https://api.vercel.com/v10/projects')) {
        return projectsResponse([]);
      }

      if (init?.method === 'POST') {
        return { json: { id: 'created-id', name: 'fresh-project', accountId: 'team-1' } };
      }

      return {};
    });

    const result = await withCwd(tmp.path, () => getVercelProject('vercel-token'));

    expect(result).toEqual({ projectId: 'created-id', projectName: 'fresh-project', orgId: 'team-1' });
    expect(select).not.toHaveBeenCalled();
    expect(calls.map((call) => call.method)).toEqual(['GET', 'POST', 'PATCH']);
    expect(calls[1]?.url).toBe('https://api.vercel.com/v11/projects');
    expect(JSON.parse(calls[1]?.body ?? '{}')).toEqual({ name: 'fresh-project', framework: 'hono' });
    expect(calls[2]?.url).toBe('https://api.vercel.com/v9/projects/created-id');
    expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ vercel: result });

    const validate = vi.mocked(input).mock.calls[0]?.[0].validate;

    expect(validate?.('   ')).toBe(false);
    expect(validate?.('project')).toBe(true);
  });

  it('selects an existing unprotected project and saves it', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('prj_1');

    const { calls } = mockFetch(() => projectsResponse([{ id: 'prj_1', name: 'existing', accountId: 'team-1' }]));

    const result = await withCwd(tmp.path, () => getVercelProject('vercel-token'));

    expect(result).toEqual({ projectId: 'prj_1', projectName: 'existing', orgId: 'team-1' });
    expect(confirm).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(JSON.parse(tmp.read('typebase.json'))).toMatchObject({ vercel: result });
  });

  it('disables protections when the user confirms for a protected project', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('prj_1');
    vi.mocked(confirm).mockResolvedValue(true);

    const { calls } = mockFetch((url) =>
      url.startsWith('https://api.vercel.com/v10/projects')
        ? projectsResponse([{ id: 'prj_1', name: 'protected', accountId: 'team-1', passwordProtection: 'enabled' }])
        : {}
    );

    const result = await withCwd(tmp.path, () => getVercelProject('vercel-token'));

    expect(result).toEqual({ projectId: 'prj_1', projectName: 'protected', orgId: 'team-1' });
    expect(confirm).toHaveBeenCalledWith({ message: 'Project is protected. Disabled protections?' });
    expect(calls.map((call) => call.method)).toEqual(['GET', 'PATCH']);
    expect(calls[1]?.url).toBe('https://api.vercel.com/v9/projects/prj_1');
  });

  it('exits when the user declines to disable protections', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('prj_1');
    vi.mocked(confirm).mockResolvedValue(false);

    mockFetch(() => projectsResponse([{ id: 'prj_1', name: 'protected', accountId: 'team-1', ssoProtection: { enabled: true } }]));

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);

    await expect(withCwd(tmp.path, () => getVercelProject('vercel-token'))).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when the selected project cannot be resolved', async () => {
    tmp.write('typebase.json', '{}');

    vi.mocked(select).mockResolvedValue('missing-project');

    mockFetch(() => projectsResponse([{ id: 'prj_1', name: 'existing', accountId: 'team-1' }]));

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);

    await expect(withCwd(tmp.path, () => getVercelProject('vercel-token'))).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
