import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateTypes } from '#helpers/shared/validate-types.ts';

import { type TempDir, createTempDir, withCwd } from '#tests/helpers/temp-dir.ts';

describe('validateTypes', () => {
  let tmp: TempDir;

  const TS_CONFIG = JSON.stringify({
    compilerOptions: { strict: true, skipLibCheck: true, noEmit: true, target: 'ESNext' },
    include: ['./**/*.ts'],
  });

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  it('passes silently when there are no type errors', () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('good.ts', 'export const value: number = 1;');

    expect(() => {
      validateTypes({
        dirPath: tmp.path,
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        skipErrors: false,
        quiet: true,
      });
    }).not.toThrow();
  });

  it('throws and reports diagnostics when type checking fails', () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('bad.ts', 'export const value: number = "not a number";');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => {
      validateTypes({
        dirPath: tmp.path,
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        skipErrors: false,
        quiet: false,
      });
    }).toThrow(/Type checking failed/);

    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('reports diagnostics but does not throw when skipErrors is true', () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('bad.ts', 'export const value: number = "not a number";');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => {
      validateTypes({
        dirPath: tmp.path,
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        skipErrors: true,
        quiet: true,
      });
    }).not.toThrow();

    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('excludes files under explicitly excluded directories', () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('good.ts', 'export const value: number = 1;');
    tmp.write('skip/bad.ts', 'export const value: number = "not a number";');

    expect(() => {
      validateTypes({
        dirPath: tmp.path,
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        skipErrors: false,
        quiet: true,
        excludeDirPaths: [path.join(tmp.path, 'skip')],
      });
    }).not.toThrow();
  });

  it('labels the current working directory as "." in the spinner message', async () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('good.ts', 'export const value: number = 1;');

    await withCwd(tmp.path, () => {
      expect(() => {
        validateTypes({
          dirPath: tmp.path,
          tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
          skipErrors: false,
          quiet: false,
        });
      }).not.toThrow();
    });
  });

  it('handles a target directory that does not exist', () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('good.ts', 'export const value: number = 1;');

    expect(() => {
      validateTypes({
        dirPath: path.join(tmp.path, 'does-not-exist'),
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        skipErrors: false,
        quiet: true,
      });
    }).not.toThrow();
  });

  it('excludes nested directories that contain their own package.json', () => {
    tmp.write('tsconfig.json', TS_CONFIG);
    tmp.write('good.ts', 'export const value: number = 1;');
    tmp.write('nested/package.json', JSON.stringify({ name: 'nested' }));
    tmp.write('nested/bad.ts', 'export const value: number = "not a number";');

    expect(() => {
      validateTypes({
        dirPath: tmp.path,
        tsConfigFilePath: path.join(tmp.path, 'tsconfig.json'),
        skipErrors: false,
        quiet: true,
      });
    }).not.toThrow();
  });
});
