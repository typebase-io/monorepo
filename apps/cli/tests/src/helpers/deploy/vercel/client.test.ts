import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VercelClient } from '#helpers/deploy/vercel/client.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

const parseBody = (body: string | undefined) => JSON.parse(body ?? '{}') as Record<string, unknown>;

describe('VercelClient', () => {
  let tmp: TempDir;
  const client = new VercelClient({ token: 'vercel-token', orgId: 'team-1' });
  const personalClient = new VercelClient({ token: 'vercel-token', orgId: undefined });

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('assigns aliases with auth headers and team scoping', async () => {
    const { calls } = mockFetch(() => ({}));

    await client.assignAlias({ deploymentId: 'dpl_1', alias: 'app-prod.vercel.app' });

    expect(calls[0]?.url).toBe('https://api.vercel.com/v2/deployments/dpl_1/aliases?teamId=team-1');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer vercel-token', 'Content-Type': 'application/json' });
    expect(parseBody(calls[0]?.body)).toEqual({ alias: 'app-prod.vercel.app' });
  });

  it('throws when assigning an alias fails', async () => {
    mockFetch(() => ({ ok: false, text: 'alias failed' }));

    await expect(client.assignAlias({ deploymentId: 'dpl_1', alias: 'app.vercel.app' })).rejects.toThrow('alias failed');
  });

  it('checks whether a project has deployments', async () => {
    const { calls } = mockFetch((url) => ({ json: { deployments: url.includes('empty-project') ? [] : [{ id: 'dpl_1' }] } }));

    await expect(client.hasAnyDeployment({ projectId: 'project-1' })).resolves.toBe(true);
    await expect(personalClient.hasAnyDeployment({ projectId: 'empty-project' })).resolves.toBe(false);

    expect(calls[0]?.url).toBe('https://api.vercel.com/v6/deployments?projectId=project-1&limit=1&teamId=team-1');
    expect(calls[1]?.url).toBe('https://api.vercel.com/v6/deployments?projectId=empty-project&limit=1');
  });

  it('throws when checking deployments fails', async () => {
    mockFetch(() => ({ ok: false, text: 'deployments unavailable' }));

    await expect(client.hasAnyDeployment({ projectId: 'project-1' })).rejects.toThrow('deployments unavailable');
  });

  it('gets a deployment by id or url', async () => {
    const { calls } = mockFetch(() => ({ json: { id: 'dpl_1', readyState: 'READY' } }));

    await expect(client.getDeployment({ idOrUrl: 'app-dev.vercel.app' })).resolves.toEqual({ id: 'dpl_1', readyState: 'READY' });

    expect(calls[0]?.url).toBe('https://api.vercel.com/v13/deployments/app-dev.vercel.app?teamId=team-1');
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer vercel-token', 'Content-Type': 'application/json' });
  });

  it('returns undefined when the deployment does not exist', async () => {
    mockFetch(() => ({ ok: false, status: 404, text: 'not found' }));

    await expect(personalClient.getDeployment({ idOrUrl: 'missing.vercel.app' })).resolves.toBeUndefined();
  });

  it('throws when getting a deployment fails', async () => {
    mockFetch(() => ({ ok: false, status: 500, text: 'deployment lookup failed' }));

    await expect(client.getDeployment({ idOrUrl: 'app-dev.vercel.app' })).rejects.toThrow('deployment lookup failed');
  });

  it('gets request logs with owner scoping and the date window', async () => {
    const rows = [{ requestId: 'req_1', requestMethod: 'GET', requestPath: '/api', statusCode: 200, logs: [] }];
    const { calls } = mockFetch(() => ({ json: { rows } }));

    await expect(
      client.getRequestLogs({ projectId: 'prj_1', deploymentId: 'dpl_1', startDate: 1_000, endDate: 2_000, signal: new AbortController().signal })
    ).resolves.toEqual(rows);

    expect(calls[0]?.url).toBe(
      'https://vercel.com/api/logs/request-logs?projectId=prj_1&deploymentId=dpl_1&page=0&startDate=1000&endDate=2000&ownerId=team-1'
    );
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer vercel-token', 'Content-Type': 'application/json' });
  });

  it('gets request logs without owner scoping and defaults missing rows to an empty array', async () => {
    const { calls } = mockFetch(() => ({ json: {} }));

    await expect(
      personalClient.getRequestLogs({
        projectId: 'prj_1',
        deploymentId: 'dpl_1',
        startDate: 1_000,
        endDate: 2_000,
        signal: new AbortController().signal,
      })
    ).resolves.toEqual([]);

    expect(calls[0]?.url).toBe('https://vercel.com/api/logs/request-logs?projectId=prj_1&deploymentId=dpl_1&page=0&startDate=1000&endDate=2000');
  });

  it('throws when getting request logs fails', async () => {
    mockFetch(() => ({ ok: false, text: 'logs unavailable' }));

    await expect(
      client.getRequestLogs({ projectId: 'prj_1', deploymentId: 'dpl_1', startDate: 1_000, endDate: 2_000, signal: new AbortController().signal })
    ).rejects.toThrow('logs unavailable');
  });

  it('reads a deployment state', async () => {
    const { calls } = mockFetch(() => ({ json: { readyState: 'BUILDING' } }));

    await expect(personalClient.getDeploymentState({ deploymentId: 'dpl_1' })).resolves.toBe('BUILDING');

    expect(calls[0]?.url).toBe('https://api.vercel.com/v13/deployments/dpl_1');
    expect(calls[0]?.method).toBe('GET');
  });

  it('throws when reading a deployment state fails', async () => {
    mockFetch(() => ({ ok: false, text: 'deployment missing' }));

    await expect(client.getDeploymentState({ deploymentId: 'dpl_1' })).rejects.toThrow('deployment missing');
  });

  it('paginates and normalizes project records', async () => {
    const { calls } = mockFetch((url) =>
      url.includes('from=123')
        ? {
            json: {
              projects: [{ id: 'prj_2', name: 'second', accountId: 'acc_2' }],
            },
          }
        : {
            json: {
              projects: [{ id: 'prj_1', name: 'first', accountId: 'acc_1', ssoProtection: { enabled: true }, passwordProtection: 'on' }],
              pagination: { next: 123 },
            },
          }
    );

    const projects = await client.getProjects();

    expect(projects).toEqual([
      { id: 'prj_1', name: 'first', accountId: 'acc_1', ssoProtection: { enabled: true }, passwordProtection: 'on' },
      { id: 'prj_2', name: 'second', accountId: 'acc_2', ssoProtection: undefined, passwordProtection: undefined },
    ]);

    expect(calls[0]?.url).toBe('https://api.vercel.com/v10/projects?limit=100&teamId=team-1');
    expect(calls[1]?.url).toBe('https://api.vercel.com/v10/projects?limit=100&teamId=team-1&from=123');
  });

  it('stops project pagination on an empty page even when a next cursor is present', async () => {
    mockFetch(() => ({ json: { projects: [], pagination: { next: 123 } } }));

    await expect(client.getProjects()).resolves.toEqual([]);
  });

  it('lists projects without team scoping for personal accounts', async () => {
    const { calls } = mockFetch(() => ({ json: { projects: [] } }));

    await expect(personalClient.getProjects()).resolves.toEqual([]);

    expect(calls[0]?.url).toBe('https://api.vercel.com/v10/projects?limit=100');
  });

  it('throws when project listing fails or returns an invalid shape', async () => {
    mockFetch(() => ({ ok: false, text: 'projects unavailable' }));

    await expect(client.getProjects()).rejects.toThrow('projects unavailable');

    mockFetch(() => ({ json: [] }));

    await expect(client.getProjects()).rejects.toThrow('Failed to fetch projects.');
  });

  it('creates projects with framework settings', async () => {
    const { calls } = mockFetch(() => ({ json: { id: 'prj_1', name: 'my-app', accountId: 'acc_1' } }));

    const project = await client.createProject({ name: 'my-app', framework: 'hono' });

    expect(project).toEqual({ id: 'prj_1', name: 'my-app', accountId: 'acc_1' });
    expect(calls[0]?.url).toBe('https://api.vercel.com/v11/projects?teamId=team-1');
    expect(calls[0]?.method).toBe('POST');
    expect(parseBody(calls[0]?.body)).toEqual({ name: 'my-app', framework: 'hono' });
  });

  it('throws when project creation fails', async () => {
    mockFetch(() => ({ ok: false, text: 'name taken' }));

    await expect(client.createProject({ name: 'my-app', framework: 'hono' })).rejects.toThrow('name taken');
  });

  it('removes project protections', async () => {
    const { calls } = mockFetch(() => ({}));

    await client.removeProtectionsToProject({ id: 'prj_1' });

    expect(calls[0]?.url).toBe('https://api.vercel.com/v9/projects/prj_1?teamId=team-1');
    expect(calls[0]?.method).toBe('PATCH');
    expect(parseBody(calls[0]?.body)).toEqual({ ssoProtection: null, passwordProtection: null });
  });

  it('throws when removing project protections fails', async () => {
    mockFetch(() => ({ ok: false, text: 'cannot update project' }));

    await expect(client.removeProtectionsToProject({ id: 'prj_1' })).rejects.toThrow('cannot update project');
  });

  it('creates deployments and maps prod targets to production', async () => {
    const { calls } = mockFetch(() => ({ json: { id: 'dpl_1', url: 'my-app.vercel.app' } }));

    const deployment = await client.createDeployment({
      name: 'my-app',
      target: 'prod',
      files: [{ file: 'src/index.js', sha: 'abc', size: 10 }],
      projectSettings: { installCommand: 'npm install', framework: null },
    });

    expect(deployment).toEqual({ status: 'ok', id: 'dpl_1', url: 'my-app.vercel.app' });
    expect(calls[0]?.url).toBe('https://api.vercel.com/v13/deployments?teamId=team-1');
    expect(parseBody(calls[0]?.body)).toEqual({
      name: 'my-app',
      target: 'production',
      files: [{ file: 'src/index.js', sha: 'abc', size: 10 }],
      projectSettings: { installCommand: 'npm install', framework: null },
    });
  });

  it('returns missing files for Vercel missing_files responses', async () => {
    mockFetch(() => ({ ok: false, status: 400, text: JSON.stringify({ error: { code: 'missing_files', missing: ['a.js', 'b.js'] } }) }));

    await expect(
      client.createDeployment({
        name: 'my-app',
        target: 'dev',
        files: [],
        projectSettings: { installCommand: 'npm install', framework: null },
      })
    ).resolves.toEqual({ status: 'missing_files', missing: ['a.js', 'b.js'] });
  });

  it('throws deployment errors with the response text or status fallback', async () => {
    mockFetch(() => ({ ok: false, status: 400, text: 'not json' }));

    await expect(
      client.createDeployment({
        name: 'my-app',
        target: 'dev',
        files: [],
        projectSettings: { installCommand: 'npm install', framework: null },
      })
    ).rejects.toThrow('not json');

    mockFetch(() => ({ ok: false, status: 500, text: '' }));

    await expect(
      client.createDeployment({
        name: 'my-app',
        target: 'dev',
        files: [],
        projectSettings: { installCommand: 'npm install', framework: null },
      })
    ).rejects.toThrow('Deployment failed with status 500');
  });

  it('uploads files with digest headers and team scoping', async () => {
    const filePath = tmp.write('one.js', 'console.log("one");');
    const { calls, fetchMock } = mockFetch(() => ({}));

    await client.uploadFiles({ files: [{ sha: 'sha-1', size: 19, absPath: filePath }] });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(calls[0]?.url).toBe('https://api.vercel.com/v2/files?teamId=team-1');
    expect(calls[0]?.method).toBe('POST');

    const headers = calls[0]?.headers ?? {};

    expect(headers.Authorization).toBe('Bearer vercel-token');
    expect(headers['Content-Type']).toBe('application/octet-stream');
    expect(headers['x-vercel-digest']).toBe('sha-1');
    expect(headers['Content-Length']).toBe('19');
    expect(calls[0]?.rawBody).toEqual(Buffer.from('console.log("one");'));
  });

  it('retries failed file uploads and eventually succeeds', async () => {
    const filePath = tmp.write('retry.js', 'retry');

    vi.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void) => {
      callback();

      return undefined;
    }) as never);

    let call = 0;

    const { fetchMock } = mockFetch(() => (call++ === 0 ? { ok: false, text: 'try again' } : {}));

    await expect(personalClient.uploadFiles({ files: [{ sha: 'sha-retry', size: 5, absPath: filePath }] })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after file upload retries are exhausted', async () => {
    const filePath = tmp.write('fail.js', 'fail');

    vi.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void) => {
      callback();

      return undefined;
    }) as never);

    const { fetchMock } = mockFetch(() => ({ ok: false, text: 'upload failed' }));

    await expect(personalClient.uploadFiles({ files: [{ sha: 'sha-fail', size: 4, absPath: filePath }] })).rejects.toThrow('upload failed');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('finds matching env vars for dev and prod targets', async () => {
    const { calls } = mockFetch(() => ({
      json: {
        envs: [
          { key: 'OTHER', target: 'production', value: 'nope' },
          { key: 'FOO', target: ['preview'], value: 'dev-value' },
          { key: 'FOO', target: 'production', value: 'prod-value' },
        ],
      },
    }));

    await expect(client.getEnvVariable({ projectId: 'prj_1', key: 'FOO', target: 'dev' })).resolves.toEqual({
      key: 'FOO',
      target: ['preview'],
      value: 'dev-value',
    });

    await expect(personalClient.getEnvVariable({ projectId: 'prj_1', key: 'FOO', target: 'prod' })).resolves.toEqual({
      key: 'FOO',
      target: 'production',
      value: 'prod-value',
    });

    await expect(client.getEnvVariable({ projectId: 'prj_1', key: 'MISSING', target: 'prod' })).resolves.toBeUndefined();

    expect(calls[0]?.url).toBe('https://api.vercel.com/v10/projects/prj_1/env?decrypt=true&teamId=team-1');
    expect(calls[1]?.url).toBe('https://api.vercel.com/v10/projects/prj_1/env?decrypt=true');
  });

  it('throws when reading env vars fails', async () => {
    mockFetch(() => ({ ok: false, text: 'env unavailable' }));

    await expect(client.getEnvVariable({ projectId: 'prj_1', key: 'FOO', target: 'dev' })).rejects.toThrow('env unavailable');
  });

  it('adds encrypted and plain env vars for the right targets', async () => {
    const { calls } = mockFetch(() => ({}));

    await client.addEnvVariable({ projectId: 'prj_1', key: 'SECRET', value: 'shh', encrypted: true, target: 'dev' });
    await personalClient.addEnvVariable({ projectId: 'prj_1', key: 'PUBLIC', value: 'value', encrypted: false, target: 'prod' });

    expect(calls[0]?.url).toBe('https://api.vercel.com/v10/projects/prj_1/env?upsert=true&teamId=team-1');
    expect(parseBody(calls[0]?.body)).toEqual({ key: 'SECRET', value: 'shh', type: 'encrypted', target: ['development', 'preview'] });
    expect(calls[1]?.url).toBe('https://api.vercel.com/v10/projects/prj_1/env?upsert=true');
    expect(parseBody(calls[1]?.body)).toEqual({ key: 'PUBLIC', value: 'value', type: 'plain', target: ['production'] });
  });

  it('throws when adding env vars fails', async () => {
    mockFetch(() => ({ ok: false, text: 'env rejected' }));

    await expect(client.addEnvVariable({ projectId: 'prj_1', key: 'SECRET', value: 'shh', encrypted: true, target: 'dev' })).rejects.toThrow(
      'env rejected'
    );
  });
});
