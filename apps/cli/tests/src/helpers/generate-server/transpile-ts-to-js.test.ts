import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { transpileTsToJs } from '#helpers/generate-server/transpile-ts-to-js.ts';

import { type TempDir, createTempDir } from '#tests/helpers/temp-dir.ts';

describe('transpileTsToJs', () => {
  let tmp: TempDir;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
    vi.restoreAllMocks();
  });

  const transpile = (cjs: boolean, quiet: boolean) => {
    transpileTsToJs({
      tsConfigFilePath: path.join(tmp.path, 'server', 'tsconfig.json'),
      cjs,
      quiet,
      tempServerDirPath: path.join(tmp.path, 'server'),
      serverDistDirPath: path.join(tmp.path, 'dist'),
    });
  };

  const tsConfig = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      compilerOptions: { strict: true, skipLibCheck: true, target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', ...extra },
      include: ['./**/*.ts'],
    });

  const distHas = (relativePath: string) => fs.existsSync(path.join(tmp.path, 'dist', relativePath));

  it('emits ESM JavaScript and shows a spinner when not quiet', () => {
    tmp.write('server/tsconfig.json', tsConfig());
    tmp.write('server/index.ts', 'export const value: number = 1;');

    transpile(false, false);

    expect(tmp.read('dist/index.js')).toContain('export const value = 1;');
  });

  it('emits CommonJS JavaScript when cjs is true', () => {
    tmp.write('server/tsconfig.json', tsConfig());
    tmp.write('server/index.ts', 'export const value: number = 1;');

    transpile(true, false);

    const out = tmp.read('dist/index.js');

    expect(out).toContain('exports.value');
    expect(out).not.toContain('export const');
  });

  it('runs without a spinner when quiet', () => {
    tmp.write('server/tsconfig.json', tsConfig());
    tmp.write('server/index.ts', 'export const value: number = 1;');

    transpile(false, true);

    expect(tmp.read('dist/index.js')).toContain('export const value = 1;');
  });

  it('emits JS even when the tsconfig sets noEmit, and skips declarations and source maps', () => {
    tmp.write('server/tsconfig.json', tsConfig({ noEmit: true, declaration: true, sourceMap: true }));
    tmp.write('server/index.ts', 'export const value: number = 1;');

    transpile(false, true);

    expect(distHas('index.js')).toBe(true);
    expect(distHas('index.d.ts')).toBe(false);
    expect(distHas('index.js.map')).toBe(false);
  });

  it('rewrites relative .ts import extensions to .js', () => {
    tmp.write('server/tsconfig.json', tsConfig({ allowImportingTsExtensions: true, noEmit: true }));
    tmp.write('server/helper.ts', 'export const helperValue = 2;');
    tmp.write('server/index.ts', `import { helperValue } from './helper.ts';\nexport const value = helperValue;`);

    transpile(false, true);

    const out = tmp.read('dist/index.js');

    expect(out).toContain(`from "./helper.js"`);
    expect(out).not.toContain('helper.ts');
  });

  it('mirrors the source directory structure from rootDir into outDir', () => {
    tmp.write('server/tsconfig.json', tsConfig());
    tmp.write('server/nested/deep/mod.ts', 'export const value = 1;');

    transpile(false, true);

    expect(distHas('nested/deep/mod.js')).toBe(true);
  });
});
