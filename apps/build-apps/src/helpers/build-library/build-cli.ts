import { cp, mkdir } from 'node:fs/promises';
import path from 'path';

import * as esbuild from 'esbuild';

export const cliExternalDependencies = ['esbuild', '@neondatabase/api-client', 'drizzle-kit', 'drizzle-orm', 'pg', 'jiti'] as const;

export const buildCli = async ({ monorepoRoot, tempDir }: { monorepoRoot: string; tempDir: string }) => {
  const cliRoot = path.join(monorepoRoot, 'apps', 'cli');
  const cliTmp = path.join(tempDir, 'cli');

  await cp(cliRoot, cliTmp, { recursive: true });

  const srcDir = path.join(cliTmp, 'src');
  const buildDir = path.join(cliTmp, 'dist');
  const esmDir = path.join(buildDir, 'esm');
  const cjsDir = path.join(buildDir, 'cjs');

  await mkdir(buildDir, { recursive: true });

  const cliAliasPlugin: esbuild.Plugin = {
    name: 'cli-path-aliases',
    setup(build) {
      build.onResolve({ filter: /^#commands\// }, (args) => ({
        path: path.resolve(srcDir, 'commands', args.path.replace('#commands/', '')),
      }));
      build.onResolve({ filter: /^#helpers\// }, (args) => ({
        path: path.resolve(srcDir, 'helpers', args.path.replace('#helpers/', '')),
      }));
    },
  };

  const esmBannerLines = [
    "import { createRequire as __banner_createRequire } from 'node:module';",
    "import { fileURLToPath as __banner_fileURLToPath } from 'node:url';",
    "import { dirname as __banner_dirname } from 'node:path';",
    'const require = __banner_createRequire(import.meta.url);',
    'const __filename = __banner_fileURLToPath(import.meta.url);',
    'const __dirname = __banner_dirname(__filename);',
  ];

  await esbuild.build({
    entryPoints: [path.join(srcDir, 'index.ts')],
    outfile: path.join(esmDir, 'typebase.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'esnext',
    banner: { js: esmBannerLines.join(' ') },
    plugins: [cliAliasPlugin],
    external: [...cliExternalDependencies],
    nodePaths: [path.join(cliRoot, 'node_modules'), path.join(monorepoRoot, 'node_modules')],
  });

  await esbuild.build({
    entryPoints: [path.join(srcDir, 'index.ts')],
    outfile: path.join(cjsDir, 'typebase.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'esnext',
    plugins: [cliAliasPlugin],
    external: [...cliExternalDependencies],
    nodePaths: [path.join(cliRoot, 'node_modules'), path.join(monorepoRoot, 'node_modules')],
  });

  return buildDir;
};
