import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import ora from 'ora';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildServer } from '#helpers/generate-server/build-server.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { validateTypes } from '#helpers/shared/validate-types.ts';

import { generateTypebaseProject } from '#tests/helpers/generate-typebase-project.ts';
import { linkBetterAuth } from '#tests/helpers/link-better-auth.ts';
import { linkTypebaseIo } from '#tests/helpers/link-typebase-io.ts';
import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

vi.mock('#helpers/shared/validate-types.ts', () => ({ validateTypes: vi.fn() }));
vi.mock('#helpers/shared/generate-server-types.ts', async (importOriginal) => {
  const actual = await importOriginal<{ generateServerTypes: unknown }>();

  return { generateServerTypes: vi.fn(actual.generateServerTypes as (...args: unknown[]) => unknown) };
});

const tempServerDirs = () => fs.readdirSync(tmpdir()).filter((entry) => entry.startsWith('typebase-server-'));

describe('buildServer', () => {
  let tmp: TempDir;

  const buildWith = ({ outDir, configuredOutDir }: { outDir: string; configuredOutDir?: string }) =>
    withCwd(tmp.path, () =>
      buildServer({
        projectPath: path.join(tmp.path, 'typebase'),
        output: 'ts',
        adapter: 'node',
        outDir,
        configuredOutDir: configuredOutDir ?? outDir,
        port: 8080,
        signal: undefined,
      })
    );

  const build = (signal?: AbortSignal) =>
    withCwd(tmp.path, () =>
      buildServer({
        projectPath: path.join(tmp.path, 'typebase'),
        output: 'ts',
        adapter: 'node',
        outDir: '_server',
        configuredOutDir: '_server',
        port: 8080,
        signal,
      })
    );

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(validateTypes).mockReset();

    tmp = createTempDir();

    linkTypebaseIo(tmp);
    linkBetterAuth(tmp);

    await generateTypebaseProject(tmp, { withAuth: false });

    vi.stubEnv('TMPDIR', tmp.mkdir('os-tmp'));

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('generates the server and reports where it went', async () => {
    const before = tempServerDirs();

    const { serverDistDirPath } = await build();

    expect(serverDistDirPath).toBe(path.join(tmp.path, 'typebase', '_server'));
    expect(fs.existsSync(path.join(serverDistDirPath, 'src', 'index.ts'))).toBe(true);
    expect(tempServerDirs()).toEqual(before);
  });

  it.each([
    { name: 'the typebase directory itself', outDir: '.' },
    { name: 'a parent of the typebase directory', outDir: '..' },
  ])('refuses to generate into $name, which replacing would delete', async ({ outDir }) => {
    fs.writeFileSync(path.join(tmp.path, 'package.json'), JSON.stringify({ name: '@typebase-io/server' }));

    await expect(
      withCwd(tmp.path, () =>
        buildServer({
          projectPath: path.join(tmp.path, 'typebase'),
          output: 'ts',
          adapter: 'node',
          outDir,
          configuredOutDir: outDir,
          port: 8080,
          signal: undefined,
        })
      )
    ).rejects.toThrow('contains your typebase directory');

    expect(fs.existsSync(path.join(tmp.path, 'typebase'))).toBe(true);
  });

  it('refuses an output directory that reaches the project root through a symlink', async () => {
    tmp.write('package.json', JSON.stringify({ name: 'the-users-app' }));

    fs.symlinkSync(tmp.path, path.join(tmp.path, 'typebase', 'out-link'), 'dir');

    await expect(buildWith({ outDir: 'out-link' })).rejects.toThrow('contains your typebase directory');

    expect(fs.existsSync(path.join(tmp.path, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp.path, 'typebase', 'actions'))).toBe(true);
  });

  it.each([{ sourceDir: 'actions' }, { sourceDir: 'db' }])(
    'refuses an output directory inside $sourceDir/, which the next run would read back as source',
    async ({ sourceDir }) => {
      await expect(buildWith({ outDir: `${sourceDir}/_server` })).rejects.toThrow(`it is inside \`${sourceDir}/\``);
    }
  );

  it('type-checks the project even when a configured output directory is overridden', async () => {
    await buildWith({ outDir: 'dist', configuredOutDir: '.' });

    const excluded = vi.mocked(validateTypes).mock.calls[0]?.[0]?.excludeDirPaths ?? [];

    expect(excluded).not.toContain(path.join(tmp.path, 'typebase'));
  });

  it('generates the publisher for a project that declares one', async () => {
    await generateTypebaseProject(tmp, { withAuth: false, withPublisher: true });

    const { serverDistDirPath } = await build();

    expect(fs.readFileSync(path.join(serverDistDirPath, 'src', 'publisher.ts'), 'utf8')).toContain('createPublisher(');
  });

  it('generates a server for a project with no actions directory', async () => {
    fs.rmSync(path.join(tmp.path, 'typebase', 'actions'), { recursive: true, force: true });

    const { serverDistDirPath } = await build();

    expect(fs.existsSync(path.join(serverDistDirPath, 'src', 'index.ts'))).toBe(true);
  });

  it('narrates each step by default', async () => {
    await build();

    expect(vi.mocked(ora).mock.calls.flat().map(String)).toEqual(expect.arrayContaining(['Generating types...', 'Generating server files...']));
    expect(vi.mocked(validateTypes).mock.calls[0]?.[0]?.quiet).toBe(false);
  });

  it('generates the same server without narrating when quiet', async () => {
    const { serverDistDirPath } = await withCwd(tmp.path, () =>
      buildServer({
        projectPath: path.join(tmp.path, 'typebase'),
        output: 'ts',
        adapter: 'node',
        outDir: '_server',
        configuredOutDir: '_server',
        port: 8080,
        quiet: true,
      })
    );

    expect(fs.existsSync(path.join(serverDistDirPath, 'src', 'index.ts'))).toBe(true);

    const started = vi.mocked(ora).mock.calls.flat().map(String);

    expect(started).not.toContain('Generating types...');
    expect(started).not.toContain('Generating server files...');
    expect(vi.mocked(validateTypes).mock.calls[0]?.[0]?.quiet).toBe(true);
  });

  it('leaves no temp directory behind when the build is cancelled', async () => {
    const before = tempServerDirs();
    const controller = new AbortController();

    vi.mocked(validateTypes).mockImplementation(() => {
      controller.abort();
    });

    await expect(build(controller.signal)).rejects.toThrow();

    expect(tempServerDirs()).toEqual(before);
  });

  it('leaves no temp directory behind when type checking fails', async () => {
    const before = tempServerDirs();

    vi.mocked(validateTypes).mockImplementation(() => {
      throw new Error('Type checking failed.');
    });

    await expect(build()).rejects.toThrow('Type checking failed.');

    expect(tempServerDirs()).toEqual(before);
  });

  it('stops the spinner when generating types fails, instead of leaving it redrawing', async () => {
    vi.mocked(generateServerTypes).mockRejectedValueOnce(new Error('codegen exploded'));

    await expect(build()).rejects.toThrow('codegen exploded');

    expect(vi.mocked(ora()).stop.mock.calls.length).toBeGreaterThan(0);
  });

  it('does not touch the output directory when the build is cancelled', async () => {
    await build();

    const indexFilePath = path.join(tmp.path, 'typebase', '_server', 'src', 'index.ts');
    const generated = fs.readFileSync(indexFilePath, 'utf8');

    const controller = new AbortController();

    vi.mocked(validateTypes).mockImplementation(() => {
      controller.abort();
    });

    await expect(build(controller.signal)).rejects.toThrow();

    expect(fs.readFileSync(indexFilePath, 'utf8')).toBe(generated);
  });
});
