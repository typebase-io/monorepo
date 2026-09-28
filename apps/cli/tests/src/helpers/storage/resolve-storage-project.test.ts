import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { resolveStorageProject } from '#helpers/storage/resolve-storage-project.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('resolveStorageProject', () => {
  let tmp: TempDir;

  const resolve = (config: Record<string, unknown>) => {
    tmp.write('typebase.json', JSON.stringify(config));

    return withCwd(tmp.path, async () => resolveStorageProject(await getTypebaseConfig()));
  };

  beforeEach(() => {
    tmp = createTempDir();
    tmp.write('package.json', JSON.stringify({ name: '@acme/My_App' }));
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it('reads the frozen project name without deriving it again', async () => {
    await expect(resolve({ storage: { project: 'frozen' }, vercel: { projectId: 'p', projectName: 'server', orgId: 'o' } })).resolves.toEqual({
      project: 'frozen',
      isNew: false,
    });
  });

  it('derives it from the server of the chosen provider first', async () => {
    await expect(
      resolve({
        serverProvider: 'cloudflare',
        vercel: { projectId: 'p', projectName: 'vercel-server', orgId: 'o' },
        cloudflare: { accountId: 'a', workerName: 'Cloudflare Worker', subdomain: 's' },
      })
    ).resolves.toEqual({ project: 'cloudflare-worker', isNew: true });
  });

  it.each([
    { name: 'vercel project', config: { vercel: { projectId: 'p', projectName: 'vercel-server', orgId: 'o' } }, project: 'vercel-server' },
    { name: 'cloudflare worker', config: { cloudflare: { accountId: 'a', workerName: 'worker', subdomain: 's' } }, project: 'worker' },
    { name: 'deno project', config: { deno: { org: 'o', projectId: 'p', slug: 'deno-app' } }, project: 'deno-app' },
  ])('derives it from the $name when no provider is chosen', async ({ config, project }) => {
    await expect(resolve(config)).resolves.toEqual({ project, isNew: true });
  });

  it('falls back to the package name when there is no server config', async () => {
    await expect(resolve({})).resolves.toEqual({ project: 'acme-my-app', isNew: true });
  });

  it('skips a candidate that leaves nothing usable', async () => {
    await expect(resolve({ vercel: { projectId: 'p', projectName: '___', orgId: 'o' } })).resolves.toEqual({ project: 'acme-my-app', isNew: true });
  });

  it('fails when nothing gives a usable name', async () => {
    tmp.write('package.json', '{}');

    await expect(resolve({})).rejects.toThrow(
      'Could not choose a storage project name: there is no server config and `package.json` has no usable `name`. Set `storage.project` in typebase.json and sync again.'
    );
  });
});
