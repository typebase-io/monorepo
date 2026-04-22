import { cp, mkdir, readFile } from 'node:fs/promises';
import path from 'path';

import { buildTypes } from '#helpers/shared/build-type.ts';
import { transpile } from '#helpers/shared/transpile.ts';

export const buildCore = async ({ monorepoRoot, tempDir }: { monorepoRoot: string; tempDir: string }) => {
  const coreRoot = path.join(monorepoRoot, 'apps', 'core');
  const coreTmp = path.join(tempDir, 'core');

  await cp(coreRoot, coreTmp, { recursive: true });

  const rootDir = coreTmp;
  const srcDir = path.join(rootDir, 'src');
  const buildDir = path.join(rootDir, 'dist');
  const esmDir = path.join(buildDir, 'esm');
  const cjsDir = path.join(buildDir, 'cjs');
  const typesDir = path.join(buildDir, 'types');

  const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf-8')) as { imports?: Record<string, string[]> };
  const paths = packageJson.imports ?? {};

  process.chdir(rootDir);

  await mkdir(buildDir, { recursive: true });
  await transpile({ rootDir, srcDir, outDir: esmDir, moduleType: 'nodenext', paths });
  await transpile({ rootDir, srcDir, outDir: cjsDir, moduleType: 'commonjs', paths });
  await buildTypes({ rootDir, srcDir, outDir: typesDir, paths });

  return buildDir;
};
