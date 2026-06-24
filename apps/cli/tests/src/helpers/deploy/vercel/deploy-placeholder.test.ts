import crypto from 'node:crypto';
import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEPS } from '#helpers/constants.ts';
import { deployPlaceholder } from '#helpers/deploy/vercel/deploy-placeholder.ts';

import { mockFetch } from '#tests/helpers/mock-fetch.ts';

interface DeploymentBody {
  name: string;
  target: 'production';
  files: { file: string; sha: string; size: number }[];
  projectSettings: { installCommand: string; framework: string };
}

const packageContent = `${JSON.stringify(
  {
    name: 'placeholder',
    version: '0.0.0',
    type: 'module',
    main: 'index.js',
    dependencies: { hono: DEPS.hono.version },
  },
  null,
  2
)}\n`;

const indexContent =
  'import { Hono } from "hono";\n\nconst app = new Hono();\napp.all("*", (c) => c.text("Placeholder..."));\n\nexport default app;\n';

const sha1 = (content: string) => crypto.createHash('sha1').update(Buffer.from(content)).digest('hex');
const parseDeploymentBody = (body: string | undefined) => JSON.parse(body ?? '{}') as DeploymentBody;

const packageSha = sha1(packageContent);
const indexSha = sha1(indexContent);

describe('deployPlaceholder', () => {
  beforeEach(() => {
    vi.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void) => {
      callback();
      return undefined;
    }) as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates a production placeholder deployment, waits for it, and removes the temp directory', async () => {
    const rmSpy = vi.spyOn(fs, 'rm');

    const { calls } = mockFetch((url, init) => {
      if (url === 'https://api.vercel.com/v13/deployments?teamId=team-1') {
        return { json: { id: 'dpl_placeholder', url: 'placeholder.vercel.app' } };
      }

      if (url === 'https://api.vercel.com/v13/deployments/dpl_placeholder?teamId=team-1') {
        return { json: { readyState: 'READY' } };
      }

      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });

    await deployPlaceholder({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1' });

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.vercel.com/v13/deployments?teamId=team-1',
      'https://api.vercel.com/v13/deployments/dpl_placeholder?teamId=team-1',
    ]);

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers).toEqual({ Authorization: 'Bearer vercel-token', 'Content-Type': 'application/json' });
    expect(calls[1]?.method).toBe('GET');
    expect(calls[1]?.headers).toEqual({ Authorization: 'Bearer vercel-token', 'Content-Type': 'application/json' });

    const body = parseDeploymentBody(calls[0]?.body);

    expect(body).toEqual({
      name: 'my-project',
      target: 'production',
      files: [
        {
          file: 'package.json',
          sha: packageSha,
          size: Buffer.byteLength(packageContent),
        },
        {
          file: 'index.js',
          sha: indexSha,
          size: Buffer.byteLength(indexContent),
        },
      ],
      projectSettings: { installCommand: 'npm install --force', framework: 'hono' },
    });

    expect(rmSpy).toHaveBeenCalledOnce();

    const removedPath = rmSpy.mock.calls[0]?.[0];

    expect(typeof removedPath).toBe('string');
    expect(removedPath).toContain('typebase-placeholder-');
    expect(rmSpy.mock.calls[0]?.[1]).toEqual({ recursive: true, force: true });

    await expect(fs.access(removedPath as string)).rejects.toThrow();
  });

  it('uploads missing placeholder files and retries the deployment without team scoping', async () => {
    const rmSpy = vi.spyOn(fs, 'rm');
    let deploymentAttempts = 0;

    const { calls } = mockFetch((url, init) => {
      if (url === 'https://api.vercel.com/v13/deployments') {
        deploymentAttempts++;

        return deploymentAttempts === 1
          ? { ok: false, status: 400, text: JSON.stringify({ error: { code: 'missing_files', missing: [indexSha] } }) }
          : { json: { id: 'dpl_retry', url: 'retry.vercel.app' } };
      }

      if (url === 'https://api.vercel.com/v2/files') {
        return {};
      }

      if (url === 'https://api.vercel.com/v13/deployments/dpl_retry') {
        return { json: { readyState: 'READY' } };
      }

      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });

    await deployPlaceholder({ token: 'vercel-token', projectName: 'my-project', orgId: undefined });

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.vercel.com/v13/deployments',
      'https://api.vercel.com/v2/files',
      'https://api.vercel.com/v13/deployments',
      'https://api.vercel.com/v13/deployments/dpl_retry',
    ]);

    expect(calls[1]?.headers['x-vercel-digest']).toBe(indexSha);
    expect(calls[1]?.headers['Content-Length']).toBe(String(Buffer.byteLength(indexContent)));
    expect(calls[1]?.rawBody).toEqual(Buffer.from(indexContent));

    const firstDeployment = parseDeploymentBody(calls[0]?.body);
    const retryDeployment = parseDeploymentBody(calls[2]?.body);

    expect(firstDeployment.files).toEqual([
      {
        file: 'package.json',
        sha: packageSha,
        size: Buffer.byteLength(packageContent),
      },
      {
        file: 'index.js',
        sha: indexSha,
        size: Buffer.byteLength(indexContent),
      },
    ]);

    expect(retryDeployment).toEqual(firstDeployment);
    expect(rmSpy).toHaveBeenCalledOnce();

    const removedPath = rmSpy.mock.calls[0]?.[0];

    expect(typeof removedPath).toBe('string');
    expect(removedPath).toContain('typebase-placeholder-');
    expect(rmSpy.mock.calls[0]?.[1]).toEqual({ recursive: true, force: true });

    await expect(fs.access(removedPath as string)).rejects.toThrow();
  });

  it('throws when the retried placeholder deployment still reports missing files', async () => {
    const rmSpy = vi.spyOn(fs, 'rm');

    const { calls } = mockFetch((url, init) => {
      if (url === 'https://api.vercel.com/v13/deployments?teamId=team-1') {
        return { ok: false, status: 400, text: JSON.stringify({ error: { code: 'missing_files', missing: [packageSha] } }) };
      }

      if (url === 'https://api.vercel.com/v2/files?teamId=team-1') {
        return {};
      }

      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });

    await expect(deployPlaceholder({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1' })).rejects.toThrow(
      'Placeholder deployment still reports missing files after upload.'
    );

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.vercel.com/v13/deployments?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v13/deployments?teamId=team-1',
    ]);

    expect(rmSpy).toHaveBeenCalledOnce();

    const removedPath = rmSpy.mock.calls[0]?.[0];

    expect(typeof removedPath).toBe('string');
    expect(removedPath).toContain('typebase-placeholder-');
    expect(rmSpy.mock.calls[0]?.[1]).toEqual({ recursive: true, force: true });

    await expect(fs.access(removedPath as string)).rejects.toThrow();
  });

  it('propagates deployment API errors before uploading files', async () => {
    const rmSpy = vi.spyOn(fs, 'rm');

    const { calls } = mockFetch((url, init) => {
      if (url === 'https://api.vercel.com/v13/deployments?teamId=team-1') {
        return { ok: false, status: 500, text: 'deployment rejected' };
      }

      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });

    await expect(deployPlaceholder({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1' })).rejects.toThrow('deployment rejected');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.vercel.com/v13/deployments?teamId=team-1');

    expect(rmSpy).toHaveBeenCalledOnce();

    const removedPath = rmSpy.mock.calls[0]?.[0];

    expect(typeof removedPath).toBe('string');
    expect(removedPath).toContain('typebase-placeholder-');
    expect(rmSpy.mock.calls[0]?.[1]).toEqual({ recursive: true, force: true });

    await expect(fs.access(removedPath as string)).rejects.toThrow();
  });

  it('propagates file upload errors and does not retry the deployment', async () => {
    const rmSpy = vi.spyOn(fs, 'rm');

    const { calls } = mockFetch((url, init) => {
      if (url === 'https://api.vercel.com/v13/deployments?teamId=team-1') {
        return { ok: false, status: 400, text: JSON.stringify({ error: { code: 'missing_files', missing: [packageSha] } }) };
      }

      if (url === 'https://api.vercel.com/v2/files?teamId=team-1') {
        return { ok: false, text: 'upload rejected' };
      }

      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });

    await expect(deployPlaceholder({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1' })).rejects.toThrow('upload rejected');

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.vercel.com/v13/deployments?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
      'https://api.vercel.com/v2/files?teamId=team-1',
    ]);

    expect(rmSpy).toHaveBeenCalledOnce();

    const removedPath = rmSpy.mock.calls[0]?.[0];

    expect(typeof removedPath).toBe('string');
    expect(removedPath).toContain('typebase-placeholder-');
    expect(rmSpy.mock.calls[0]?.[1]).toEqual({ recursive: true, force: true });

    await expect(fs.access(removedPath as string)).rejects.toThrow();
  });

  it('propagates wait failures after creating the placeholder deployment', async () => {
    const rmSpy = vi.spyOn(fs, 'rm');

    const { calls } = mockFetch((url, init) => {
      if (url === 'https://api.vercel.com/v13/deployments?teamId=team-1') {
        return { json: { id: 'dpl_placeholder', url: 'placeholder.vercel.app' } };
      }

      if (url === 'https://api.vercel.com/v13/deployments/dpl_placeholder?teamId=team-1') {
        return { json: { readyState: 'ERROR' } };
      }

      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });

    await expect(deployPlaceholder({ token: 'vercel-token', projectName: 'my-project', orgId: 'team-1' })).rejects.toThrow(
      'Placeholder deployment dpl_placeholder ended in ERROR state.'
    );

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.vercel.com/v13/deployments?teamId=team-1',
      'https://api.vercel.com/v13/deployments/dpl_placeholder?teamId=team-1',
    ]);

    expect(rmSpy).toHaveBeenCalledOnce();

    const removedPath = rmSpy.mock.calls[0]?.[0];

    expect(typeof removedPath).toBe('string');
    expect(removedPath).toContain('typebase-placeholder-');
    expect(rmSpy.mock.calls[0]?.[1]).toEqual({ recursive: true, force: true });

    await expect(fs.access(removedPath as string)).rejects.toThrow();
  });
});
