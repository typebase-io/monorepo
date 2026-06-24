import { execFile } from 'node:child_process';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deploy } from '#helpers/deploy/cloudflare/deploy.ts';
import { getPackageManagerInstallCommand } from '#helpers/shared/get-package-manager-install-command.ts';

import { buildTypebaseServer } from '#tests/helpers/build-typebase-server.ts';
import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { type MockFetchResult, mockFetch } from '#tests/helpers/mock-fetch.ts';
import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

vi.mock('node:child_process', () => {
  return { execFile: vi.fn() };
});

vi.mock('#helpers/shared/get-package-manager-install-command.ts', () => {
  return { getPackageManagerInstallCommand: vi.fn() };
});

const captureUpload = (response: MockFetchResult) => {
  let body: FormData | undefined;

  const { calls } = mockFetch((_url, init) => {
    body = init?.body as FormData | undefined;

    return response;
  });

  return {
    calls,
    getForm: () => {
      if (!body) {
        throw new Error('fetch was not called with a FormData body');
      }

      return body;
    },
  };
};

const readMetadata = async (form: FormData) => JSON.parse(await (form.get('metadata') as Blob).text()) as Record<string, unknown>;
const readBundle = (form: FormData) => (form.get('index.js') as File).text();

describe('deploy', () => {
  let tmp: TempDir;
  let serverDirPath: string;

  beforeEach(() => {
    tmp = createTempDir();

    tmp.write('server/package.json', JSON.stringify({ name: '@typebase-io/server', type: 'module', version: '1.0.0' }));
    tmp.write(
      'server/src/index.js',
      `
        import nodePath from "node:path";
        import nodeFs from "fs";
        import { env } from "cloudflare:workers";

        const nodeOs = require("os");
        const nodeUtil = require("node:util");

        export default {
          async fetch() {
            return new Response(
              "WORKER_MARKER " + nodePath.sep + typeof nodeFs + typeof nodeOs + typeof nodeUtil + String(env),
            );
          },
        };
      `
    );

    serverDirPath = path.join(tmp.path, 'server');

    vi.mocked(getPackageManagerInstallCommand).mockResolvedValue('npm install');

    vi.mocked(execFile).mockImplementation(((...callArgs: unknown[]) => {
      const cb = callArgs[callArgs.length - 1] as (error: unknown, result?: unknown) => void;
      cb(null, { stdout: '', stderr: '' });
    }) as never);
  });

  afterEach(() => {
    tmp.cleanup();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('installs deps, bundles the worker with esbuild, uploads it and returns the deployment id', async () => {
    const { calls, getForm } = captureUpload({ ok: true, json: { result: { etag: 'etag-abc' } } });

    const result = await deploy({
      token: 'cf-token',
      accountId: 'acc-1',
      workerName: 'my-worker',
      serverDirPath,
      env: [{ key: 'SECRET_KEY', value: 'secret-val', secret: true }],
    });

    expect(result).toEqual({ deploymentId: 'etag-abc' });

    expect(execFile).toHaveBeenCalledWith('npm', ['install'], { cwd: serverDirPath }, expect.any(Function));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc-1/workers/scripts/my-worker');
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.headers.Authorization).toBe('Bearer cf-token');

    const form = getForm();
    const metadata = await readMetadata(form);

    expect(metadata.main_module).toBe('index.js');
    expect(metadata.compatibility_flags).toEqual(['nodejs_compat']);
    expect(metadata.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(metadata.bindings).toEqual([{ type: 'secret_text', name: 'SECRET_KEY', text: 'secret-val' }]);
    expect(metadata.keep_bindings).toEqual(['secret_text', 'plain_text']);

    const bundle = await readBundle(form);

    expect(bundle).toContain('WORKER_MARKER');
    expect(bundle).toContain('node:path');
    expect(bundle).toContain('node:fs');
    expect(bundle).toContain('import mod from "node:os"');
    expect(bundle).toContain('cloudflare:workers');
  });

  it('omits the bindings field when there are no env vars', async () => {
    const { getForm } = captureUpload({ ok: true, json: { result: { etag: 'etag-1' } } });

    await deploy({
      token: 'cf-token',
      accountId: 'acc-1',
      workerName: 'my-worker',
      serverDirPath,
      env: [],
    });

    const metadata = await readMetadata(getForm());

    expect(metadata.bindings).toBeUndefined();
  });

  it('uses a plain_text binding for non-secret env vars', async () => {
    const { getForm } = captureUpload({ ok: true, json: { result: { etag: 'etag-1' } } });

    await deploy({
      token: 'cf-token',
      accountId: 'acc-1',
      workerName: 'my-worker',
      serverDirPath,
      env: [{ key: 'PUBLIC_KEY', value: 'public-val', secret: false }],
    });

    const metadata = await readMetadata(getForm());

    expect(metadata.bindings).toEqual([{ type: 'plain_text', name: 'PUBLIC_KEY', text: 'public-val' }]);
  });

  it('throws and does not bundle or upload when installing dependencies fails', async () => {
    vi.mocked(execFile).mockImplementation(((...callArgs: unknown[]) => {
      const cb = callArgs[callArgs.length - 1] as (error: unknown) => void;
      cb(new Error('install exploded'));
    }) as never);

    const { calls } = captureUpload({ ok: true, json: { result: { etag: 'never' } } });

    await expect(
      deploy({
        token: 'cf-token',
        accountId: 'acc-1',
        workerName: 'my-worker',
        serverDirPath,
        env: [],
      })
    ).rejects.toThrow('install exploded');

    expect(calls).toHaveLength(0);
  });

  it('throws when esbuild fails to bundle an invalid worker', async () => {
    tmp.write('server/src/index.js', 'export default { fetch() { return new Response(');

    const { calls } = captureUpload({ ok: true, json: { result: { etag: 'never' } } });

    await expect(
      deploy({
        token: 'cf-token',
        accountId: 'acc-1',
        workerName: 'my-worker',
        serverDirPath,
        env: [],
      })
    ).rejects.toThrow();

    expect(calls).toHaveLength(0);
  });

  it('throws a Cloudflare API error when the upload is rejected', async () => {
    captureUpload({ ok: false, text: 'script too big' });

    await expect(
      deploy({
        token: 'cf-token',
        accountId: 'acc-1',
        workerName: 'my-worker',
        serverDirPath,
        env: [],
      })
    ).rejects.toThrow('Cloudflare API error: script too big');
  });

  it('bundles and uploads a real generated typebase server (auth template)', async () => {
    const projectDir = await generateTypebaseProject(tmp);
    const serverDir = await buildTypebaseServer(tmp, projectDir, { provider: 'cloudflare' });

    const { calls, getForm } = captureUpload({ ok: true, json: { result: { etag: 'real-etag' } } });

    const result = await deploy({
      token: 'cf-token',
      accountId: 'acc-1',
      workerName: 'my-worker',
      serverDirPath: serverDir,
      env: [{ key: 'BETTER_AUTH_SECRET', value: 'shh', secret: true }],
    });

    expect(result).toEqual({ deploymentId: 'real-etag' });
    expect(calls).toHaveLength(1);

    const bundle = await readBundle(getForm());

    expect(bundle.length).toBeGreaterThan(200);
    expect(bundle).toContain('fetch');
    expect(bundle).toContain('RPCHandler');
  });
});
