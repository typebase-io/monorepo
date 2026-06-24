import crypto from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deploy } from '#helpers/deploy/vercel/deploy.ts';

import { buildTypebaseServer } from '#tests/helpers/build-typebase-server.ts';
import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { mockFetch } from '#tests/helpers/mock-fetch.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

interface DeploymentBody {
  name: string;
  target: 'staging' | 'production';
  files: { file: string; sha: string; size: number }[];
  projectSettings: { installCommand: string; framework: string | null };
}

const sha1 = (content: string) => crypto.createHash('sha1').update(Buffer.from(content)).digest('hex');
const parseDeploymentBody = (body: string | undefined) => JSON.parse(body ?? '{}') as DeploymentBody;

describe('vercel deploy', () => {
  let tmp: TempDir;
  let serverDirPath: string;

  beforeEach(async () => {
    tmp = createTempDir();

    const projectDir = await generateTypebaseProject(tmp);
    serverDirPath = await buildTypebaseServer(tmp, projectDir, { provider: 'vercel' });

    tmp.write('server/marker.txt', 'MARKER_CONTENT');
    tmp.write('server/node_modules/dep/index.js', 'module.exports = {};');
    tmp.write('server/dist/index.js', 'dist output');
    tmp.write('server/build/index.js', 'build output');
    tmp.write('server/_server/index.js', 'generated output');
  });

  afterEach(() => {
    tmp.cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates a production deployment from a real generated Typebase server', async () => {
    const { calls } = mockFetch(() => ({ json: { id: 'dpl_prod', url: 'my-project.vercel.app' } }));

    const result = await withCwd(tmp.path, () =>
      deploy({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1', serverDirPath, target: 'prod' })
    );

    expect(result).toEqual({ deploymentId: 'dpl_prod', url: 'my-project.vercel.app' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.vercel.com/v13/deployments?teamId=team-1');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer vercel-token', 'Content-Type': 'application/json' });

    const body = parseDeploymentBody(calls[0]?.body);
    const files = new Map(body.files.map((file) => [file.file, file]));

    expect(body.name).toBe('my-project');
    expect(body.target).toBe('production');
    expect(body.projectSettings).toEqual({ installCommand: 'npm install --force', framework: 'hono' });
    expect(files.get('src/index.js')).toEqual(expect.objectContaining({ file: 'src/index.js' }));
    expect(files.get('src/actions/queries/todos.js')).toEqual(expect.objectContaining({ file: 'src/actions/queries/todos.js' }));
    expect(files.get('src/actions/mutations/todos.js')).toEqual(expect.objectContaining({ file: 'src/actions/mutations/todos.js' }));
    expect(files.get('marker.txt')).toEqual({ file: 'marker.txt', sha: sha1('MARKER_CONTENT'), size: Buffer.byteLength('MARKER_CONTENT') });
    expect(files.has('node_modules/dep/index.js')).toBe(false);
    expect(files.has('dist/index.js')).toBe(false);
    expect(files.has('build/index.js')).toBe(false);
    expect(files.has('_server/index.js')).toBe(false);
  });

  it('marks dev deployments as staging and omits team scoping without an org id', async () => {
    const { calls } = mockFetch(() => ({ json: { id: 'dpl_dev', url: 'my-project-git-main.vercel.app' } }));

    const result = await withCwd(tmp.path, () =>
      deploy({ token: 'vercel-token', projectName: 'my-project', orgId: undefined, serverDirPath, target: 'dev' })
    );

    expect(result).toEqual({ deploymentId: 'dpl_dev', url: 'my-project-git-main.vercel.app' });
    expect(calls[0]?.url).toBe('https://api.vercel.com/v13/deployments');

    const body = parseDeploymentBody(calls[0]?.body);

    expect(body.target).toBe('staging');
  });

  it('skips a configured server output directory', async () => {
    tmp.write('typebase.json', JSON.stringify({ server: { outDir: 'generated-server' } }));
    tmp.write('server/generated-server/index.js', 'custom generated output');

    const { calls } = mockFetch(() => ({ json: { id: 'dpl_custom', url: 'my-project.vercel.app' } }));

    await withCwd(tmp.path, () => deploy({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1', serverDirPath, target: 'prod' }));

    const body = parseDeploymentBody(calls[0]?.body);

    expect(body.files.some(({ file }) => file === 'generated-server/index.js')).toBe(false);
  });

  it('uploads only missing files and retries the deployment', async () => {
    tmp.write('server/upload-me.txt', 'UPLOAD_ME');
    tmp.write('server/already-present.txt', 'ALREADY_PRESENT');

    const missingSha = sha1('UPLOAD_ME');
    let deploymentAttempts = 0;

    const { calls } = mockFetch((url, init) => {
      if (url.startsWith('https://api.vercel.com/v13/deployments')) {
        deploymentAttempts++;

        return deploymentAttempts === 1
          ? { ok: false, status: 400, text: JSON.stringify({ error: { code: 'missing_files', missing: [missingSha] } }) }
          : { json: { id: 'dpl_retry', url: 'retry.vercel.app' } };
      }

      if (url.startsWith('https://api.vercel.com/v2/files')) {
        return {};
      }

      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });

    const result = await withCwd(tmp.path, () =>
      deploy({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1', serverDirPath, target: 'prod' })
    );

    expect(result).toEqual({ deploymentId: 'dpl_retry', url: 'retry.vercel.app' });

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.vercel.com/v13/deployments?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v13/deployments?teamId=team-1',
    ]);

    expect(calls[1]?.headers['x-vercel-digest']).toBe(missingSha);
    expect(calls[1]?.headers['Content-Length']).toBe(String(Buffer.byteLength('UPLOAD_ME')));
    expect(calls[1]?.rawBody).toEqual(Buffer.from('UPLOAD_ME'));

    const firstDeployment = parseDeploymentBody(calls[0]?.body);
    const retryDeployment = parseDeploymentBody(calls[2]?.body);

    expect(retryDeployment.files).toEqual(firstDeployment.files);
  });

  it('throws when the retried deployment still reports missing files', async () => {
    const missingSha = sha1('MARKER_CONTENT');

    mockFetch((url) =>
      url.startsWith('https://api.vercel.com/v13/deployments')
        ? { ok: false, status: 400, text: JSON.stringify({ error: { code: 'missing_files', missing: [missingSha] } }) }
        : {}
    );

    await expect(
      withCwd(tmp.path, () => deploy({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1', serverDirPath, target: 'prod' }))
    ).rejects.toThrow('Deployment still reports missing files after upload.');
  });

  it('propagates deployment API errors before uploading files', async () => {
    const { calls } = mockFetch(() => ({ ok: false, status: 500, text: 'deployment rejected' }));

    await expect(
      withCwd(tmp.path, () => deploy({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1', serverDirPath, target: 'prod' }))
    ).rejects.toThrow('deployment rejected');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.vercel.com/v13/deployments?teamId=team-1');
  });

  it('propagates file upload errors and does not retry the deployment', async () => {
    const missingSha = sha1('MARKER_CONTENT');

    vi.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void) => {
      callback();
      return undefined;
    }) as never);

    const { calls } = mockFetch((url) => {
      if (url.startsWith('https://api.vercel.com/v13/deployments')) {
        return { ok: false, status: 400, text: JSON.stringify({ error: { code: 'missing_files', missing: [missingSha] } }) };
      }

      return { ok: false, text: 'upload rejected' };
    });

    await expect(
      withCwd(tmp.path, () => deploy({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1', serverDirPath, target: 'prod' }))
    ).rejects.toThrow('upload rejected');

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.vercel.com/v13/deployments?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
    ]);
  });
});
