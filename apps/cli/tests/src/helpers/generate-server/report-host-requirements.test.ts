import path from 'node:path';

import chalk from 'chalk';
import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reportHostRequirements } from '#helpers/generate-server/report-host-requirements.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('reportHostRequirements', () => {
  let tmp: TempDir;
  const originalColorLevel = chalk.level;

  beforeEach(() => {
    tmp = createTempDir();
    chalk.level = 0;
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    chalk.level = originalColorLevel;
    tmp.cleanup();
  });

  it.each([
    { lockfile: 'package-lock.json', fixture: 'npm' },
    { lockfile: 'pnpm-lock.yaml', fixture: 'pnpm' },
    { lockfile: 'yarn.lock', fixture: 'yarn' },
    { lockfile: 'bun.lock', fixture: 'bun' },
    { lockfile: 'package-lock.json', fixture: 'npm-colored' },
  ])('reports missing dependencies using $fixture', async ({ lockfile, fixture }) => {
    chalk.level = fixture === 'npm-colored' ? 1 : 0;
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: '^8.0.0' } }));
    tmp.write(lockfile, '');

    await withCwd(tmp.path, () =>
      reportHostRequirements({
        serverDistDirPath: path.join(tmp.path, 'generated'),
        adapter: 'node',
        output: 'ts',
        dependencies: { pg: '8.20.0', zod: '^4' },
        devDependencies: { typescript: '5.9.3' },
        envKeys: ['DATABASE_URL'],
      })
    );

    expect(vi.mocked(console.log).mock.calls.flat().join('\n').replaceAll('\u001b', '<ESC>')).toEqualTemplate(
      'report-host-requirements',
      `${fixture}.txt`
    );
    expect(vi.mocked(ora()).warn.mock.calls).toEqual([]);
  });

  it('prints dependency warnings after the title and before installation instructions', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: '^7', zod: '^4' }, devDependencies: { typescript: '^4' } }));

    await withCwd(tmp.path, () =>
      reportHostRequirements({
        serverDistDirPath: path.join(tmp.path, 'generated'),
        adapter: 'node',
        output: 'ts',
        dependencies: { pg: '8.20.0', zod: '^4' },
        devDependencies: { typescript: '5.9.3' },
        envKeys: ['DATABASE_URL'],
      })
    );

    expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('report-host-requirements', 'mismatched.txt');
    expect(vi.mocked(ora()).warn.mock.calls).toEqual([
      ['Host dependency `typescript@^4` does not include the generated server requirement `5.9.3`. Update the host dependency.'],
      ['Host dependency `pg@^7` does not include the generated server requirement `8.20.0`. Update the host dependency.'],
    ]);
    expect(vi.mocked(console.log).mock.calls[0]).toEqual(['\nEmbedded server requirements']);
    expect(vi.mocked(console.log).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(ora()).warn.mock.invocationCallOrder[0] ?? 0);
    expect(vi.mocked(ora()).warn.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(console.log).mock.invocationCallOrder[1] ?? 0);
  });

  it('reports no installation or environment setup when the host already provides everything', async () => {
    tmp.write('package.json', JSON.stringify({ dependencies: { pg: '^8' }, devDependencies: { typescript: '^5' } }));

    await withCwd(tmp.path, () =>
      reportHostRequirements({
        serverDistDirPath: path.join(tmp.path, '.generated'),
        adapter: 'node',
        output: 'cjs',
        dependencies: { pg: '8.20.0' },
        devDependencies: { typescript: '5.9.3' },
        envKeys: [],
      })
    );

    expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('report-host-requirements', 'satisfied.txt');
  });

  it.each([
    { lockfile: 'package-lock.json', fixture: 'npm' },
    { lockfile: 'pnpm-lock.yaml', fixture: 'pnpm' },
    { lockfile: 'yarn.lock', fixture: 'yarn' },
    { lockfile: 'bun.lock', fixture: 'bun' },
  ])('uses the separate host package manager $fixture instead of the source project manager', async ({ lockfile, fixture }) => {
    tmp.write('package.json', '{}');
    tmp.write('bun.lock', '');
    tmp.write('host/package.json', JSON.stringify({ dependencies: { pg: '^8' } }));
    tmp.write(`host/${lockfile}`, '');

    await withCwd(tmp.path, () =>
      reportHostRequirements({
        serverDistDirPath: path.join(tmp.path, 'host/src/generated'),
        adapter: 'node',
        output: 'ts',
        dependencies: { pg: '8.20.0', zod: '^4' },
        devDependencies: { typescript: '5.9.3' },
        envKeys: ['DATABASE_URL'],
      })
    );

    expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('report-host-requirements', `nested-${fixture}.txt`);
  });

  it('reports a parent-relative import when the host output is outside the working directory', async () => {
    tmp.write('package.json', '{}');

    const sourceDir = tmp.mkdir('source');

    await withCwd(sourceDir, () =>
      reportHostRequirements({
        serverDistDirPath: path.join(tmp.path, 'generated'),
        adapter: 'node',
        output: 'ts',
        dependencies: { zod: '^4' },
        devDependencies: { typescript: '5.9.3' },
        envKeys: ['DATABASE_URL'],
      })
    );

    expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('report-host-requirements', 'parent-output.txt');
  });

  it('provides installation instructions even when a host manifest does not exist yet', async () => {
    await withCwd(tmp.path, () =>
      reportHostRequirements({
        serverDistDirPath: path.join(tmp.path, 'generated'),
        adapter: 'node',
        output: 'ts',
        dependencies: { zod: '^4' },
        devDependencies: { typescript: '5.9.3' },
        envKeys: ['DATABASE_URL'],
      })
    );

    expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toEqualTemplate('report-host-requirements', 'npm.txt');
    expect(vi.mocked(ora()).warn.mock.calls).toEqual([
      [`Cannot validate host dependencies: no package.json was found above \`${tmp.path}\`. See typebase-server.json for the required dependencies.`],
    ]);
  });
});
