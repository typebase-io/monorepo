import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deploy } from '#helpers/deploy/deno/deploy.ts';

import { buildTypebaseServer } from '#tests/helpers/build-typebase-server.ts';
import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { mockFetch } from '#tests/helpers/mock-fetch.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

interface DeployBody {
  assets: Record<string, { kind: string; content: string; encoding: string }>;
  config: { install: string; build: null; runtime: { type: string; entrypoint: string } };
  preview: boolean;
  production: boolean;
}

describe('deno deploy', () => {
  let tmp: TempDir;
  let serverDirPath: string;

  beforeEach(async () => {
    tmp = createTempDir();

    const projectDir = await generateTypebaseProject(tmp);
    serverDirPath = await buildTypebaseServer(tmp, projectDir, { provider: 'deno' });

    tmp.write('server/image.png', 'PNGDATA');
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

  it('uploads the server assets and returns the revision id for a prod deployment', async () => {
    const { calls } = mockFetch(() => ({ json: { id: 'rev-123' } }));

    const result = await withCwd(tmp.path, () => deploy({ token: 'deno-token', projectId: 'proj-1', serverDirPath, target: 'prod' }));

    expect(result).toEqual({ revisionId: 'rev-123' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.deno.com/v2/apps/proj-1/deploy');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers.Authorization).toBe('Bearer deno-token');

    const body = JSON.parse(calls[0]?.body ?? '{}') as DeployBody;

    expect(body.assets['src/index.js']?.encoding).toBe('utf-8');
    expect(body.assets['src/index.js']?.content).toContain('fetch');
    expect(body.assets['src/index.js']?.content).toContain('RPCHandler');
    expect(body.assets['src/actions/queries/todos.js']?.encoding).toBe('utf-8');
    expect(body.assets['src/actions/mutations/todos.js']?.encoding).toBe('utf-8');
    expect(body.assets['image.png']).toEqual({ kind: 'file', content: Buffer.from('PNGDATA').toString('base64'), encoding: 'base64' });
    expect(body.assets['node_modules/dep/index.js']).toBeUndefined();
    expect(body.assets['dist/index.js']).toBeUndefined();
    expect(body.assets['build/index.js']).toBeUndefined();
    expect(body.assets['_server/index.js']).toBeUndefined();

    expect(body.config.install).toBe('npm install --force');
    expect(body.config.build).toBeNull();
    expect(body.config.runtime).toEqual({ type: 'dynamic', entrypoint: 'src/index.js' });
    expect(body.preview).toBe(false);
    expect(body.production).toBe(true);
  });

  it('marks the deployment as a preview for a dev deployment', async () => {
    const { calls } = mockFetch(() => ({ json: { id: 'rev-dev' } }));

    const result = await withCwd(tmp.path, () => deploy({ token: 'deno-token', projectId: 'proj-1', serverDirPath, target: 'dev' }));

    expect(result).toEqual({ revisionId: 'rev-dev' });

    const body = JSON.parse(calls[0]?.body ?? '{}') as DeployBody;

    expect(body.preview).toBe(true);
    expect(body.production).toBe(false);
  });

  it('skips a configured server output directory', async () => {
    tmp.write('typebase.json', JSON.stringify({ server: { outDir: 'generated-server' } }));
    tmp.write('server/generated-server/index.js', 'custom generated output');

    const { calls } = mockFetch(() => ({ json: { id: 'rev-custom' } }));

    await withCwd(tmp.path, () => deploy({ token: 'deno-token', projectId: 'proj-1', serverDirPath, target: 'prod' }));

    const body = JSON.parse(calls[0]?.body ?? '{}') as DeployBody;

    expect(body.assets['generated-server/index.js']).toBeUndefined();
  });

  it('throws a Deno Deploy API error when the deployment request fails', async () => {
    mockFetch(() => ({ ok: false, text: 'quota exceeded' }));

    await expect(withCwd(tmp.path, () => deploy({ token: 'deno-token', projectId: 'proj-1', serverDirPath, target: 'prod' }))).rejects.toThrow(
      'Deno Deploy API error: quota exceeded'
    );
  });
});
