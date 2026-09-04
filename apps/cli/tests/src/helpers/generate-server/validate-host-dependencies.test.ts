import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateHostDependencies } from '#helpers/generate-server/validate-host-dependencies.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('validateHostDependencies', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it.each([
    { declared: '8.20.0', required: '8.20.0' },
    { declared: '^8.0.0', required: '8.20.0' },
    { declared: '~8.20.0', required: '8.20.0' },
    { declared: '8.x', required: '8.20.0' },
    { declared: '>=8 <9', required: '8.20.0' },
    { declared: '^7 || ^8', required: '8.20.0' },
    { declared: '^8.10.0', required: '>=8.20.0 <9' },
    { declared: '^1.0.0-beta.20', required: '1.0.0-beta.22' },
  ])('accepts $declared when the generated server requires $required', async ({ declared, required }) => {
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: declared } }));

    await validateHostDependencies({ hostDirPath: tmp.path, dependencies: { pg: required } });

    expect(vi.mocked(ora()).warn.mock.calls).toEqual([]);
  });

  it.each([
    { declared: '^7.0.0', required: '8.20.0' },
    { declared: '>=9', required: '^8.0.0' },
    { declared: '*', required: '1.0.0-beta.22' },
  ])('warns when $declared excludes $required', async ({ declared, required }) => {
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: declared } }));

    const result = await validateHostDependencies({ hostDirPath: tmp.path, dependencies: { pg: required } });

    expect(result.dependenciesToInstall).toEqual({ pg: required });
    expect(vi.mocked(ora()).warn.mock.calls).toEqual([
      [`Host dependency \`pg@${declared}\` does not include the generated server requirement \`${required}\`. Update the host dependency.`],
    ]);
  });

  it.each([
    { declared: 'workspace:*', required: '8.20.0' },
    { declared: 'file:../pg', required: '8.20.0' },
    { declared: 'latest', required: '8.20.0' },
    { declared: 'not-a-version', required: '8.20.0' },
    { declared: '^8.0.0', required: 'workspace:*' },
  ])('warns without throwing when $declared or $required cannot be checked with semver', async ({ declared, required }) => {
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: declared } }));

    await validateHostDependencies({ hostDirPath: tmp.path, dependencies: { pg: required } });

    expect(vi.mocked(ora()).warn.mock.calls).toEqual([
      [`Cannot validate host dependency \`pg@${declared}\` against \`${required}\` using semver. Check that it supports the generated server.`],
    ]);
  });

  it.each(['dependencies', 'devDependencies', 'optionalDependencies'])('recognizes packages in %s', async (section) => {
    tmp.write('package.json', JSON.stringify({ [section]: { pg: '^8.0.0' } }));

    await validateHostDependencies({ hostDirPath: tmp.path, dependencies: { pg: '8.20.0' } });

    expect(vi.mocked(ora()).warn.mock.calls).toEqual([]);
  });

  it('returns missing dependencies and continues checking the remaining packages', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { hono: '^4.0.0' } }));

    const { dependenciesToInstall: missing, hostDirPath } = await validateHostDependencies({
      hostDirPath: tmp.path,
      dependencies: { pg: '8.20.0', hono: '4.12.18', fastify: '5.8.5' },
    });

    expect(missing).toEqual({ pg: '8.20.0', fastify: '5.8.5' });
    expect(hostDirPath).toBe(tmp.path);
    expect(vi.mocked(ora()).warn.mock.calls).toEqual([]);
  });

  it('reports missing dependencies when the manifest has no dependency sections', async () => {
    tmp.write('package.json', '{}');

    expect(await validateHostDependencies({ hostDirPath: tmp.path, dependencies: { pg: '8.20.0' } })).toEqual({
      dependenciesToInstall: { pg: '8.20.0' },
      hostDirPath: tmp.path,
    });
    expect(vi.mocked(ora()).warn.mock.calls).toEqual([]);
  });

  it('uses the closest host manifest above the output directory', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: '^7.0.0' } }));
    tmp.write('host/package.json', JSON.stringify({ dependencies: { pg: '^8.0.0' } }));

    const hostDirPath = tmp.mkdir('host/src/generated');

    await validateHostDependencies({ hostDirPath, dependencies: { pg: '8.20.0' } });

    expect(vi.mocked(ora()).warn.mock.calls).toEqual([]);
  });

  it('warns without failing when there is no host manifest', async () => {
    await validateHostDependencies({ hostDirPath: tmp.path, dependencies: { pg: '8.20.0' } });

    expect(vi.mocked(ora()).warn.mock.calls).toEqual([
      [`Cannot validate host dependencies: no package.json was found above \`${tmp.path}\`. See typebase-server.json for the required dependencies.`],
    ]);
  });

  it('uses a runtime dependency declaration ahead of a development declaration', async () => {
    tmp.write('package.json', JSON.stringify({ devDependencies: { pg: '^7.0.0' }, dependencies: { pg: '^8.0.0' } }));

    await validateHostDependencies({ hostDirPath: tmp.path, dependencies: { pg: '8.20.0' } });

    expect(vi.mocked(ora()).warn.mock.calls).toEqual([]);
  });

  it('uses an optional dependency declaration ahead of a runtime declaration', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: '^7.0.0' }, optionalDependencies: { pg: '^8.0.0' } }));

    await validateHostDependencies({ hostDirPath: tmp.path, dependencies: { pg: '8.20.0' } });

    expect(vi.mocked(ora()).warn.mock.calls).toEqual([]);
  });
});
