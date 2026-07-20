import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'path';

import { Command } from '@commander-js/extra-typings';
import chalk from 'chalk';
import ora from 'ora';

import { buildCli } from '#helpers/build-library/build-cli.ts';
import { buildCore } from '#helpers/build-library/build-core.ts';
import { loadCatalog, resolveCatalogVersions } from '#helpers/shared/catalog.ts';
import { findMonorepoRoot } from '#helpers/shared/find-monorepo-root.ts';

export const buildLibrary = new Command('build-library')
  .summary('Builds the publishable library')
  .requiredOption('-v, --version <version>', 'Semantic version for the package (e.g. 1.2.3)', (value) => {
    if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/.test(value)) {
      throw new Error(`Invalid semver version: "${value}"`);
    }

    return value;
  })
  .allowExcessArguments(false)
  .action(async ({ version }) => {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    const publishDir = path.join(monorepoRoot, 'publish');
    const libraryDir = path.join(publishDir, 'library');
    const distDir = path.join(libraryDir, 'dist');
    const tempDir = path.join(monorepoRoot, '.tmp-build');

    const spinner = ora(`Building publishable ${chalk.cyan('typebase')} package...`).start();

    await rm(libraryDir, { recursive: true, force: true });
    await mkdir(tempDir, { recursive: true });

    try {
      spinner.text = `Building ${chalk.cyan('core')}...`;
      const coreBuildDir = await buildCore({ monorepoRoot, tempDir });

      spinner.text = `Bundling ${chalk.cyan('CLI')}...`;
      const cliBuildDir = await buildCli({ monorepoRoot, tempDir });

      spinner.text = `Assembling ${chalk.cyan('publish/library')} directory...`;

      await mkdir(libraryDir, { recursive: true });
      await mkdir(distDir, { recursive: true });

      await cp(path.join(coreBuildDir, 'esm'), path.join(distDir, 'esm'), { recursive: true });
      await cp(path.join(coreBuildDir, 'cjs'), path.join(distDir, 'cjs'), { recursive: true });
      await cp(path.join(coreBuildDir, 'types'), path.join(distDir, 'types'), { recursive: true });

      const binDir = path.join(distDir, 'bin');
      await mkdir(binDir, { recursive: true });
      await cp(path.join(cliBuildDir, 'esm', 'typebase.js'), path.join(binDir, 'typebase.js'));
      await cp(path.join(cliBuildDir, 'cjs', 'typebase.cjs'), path.join(binDir, 'typebase.cjs'));

      const corePackageJson = JSON.parse(await readFile(path.join(monorepoRoot, 'apps', 'core', 'package.json'), 'utf-8')) as {
        dependencies: Record<string, string>;
        peerDependencies: Record<string, string>;
        peerDependenciesMeta: Record<string, unknown>;
      };

      const cliPackageJson = JSON.parse(await readFile(path.join(monorepoRoot, 'apps', 'cli', 'package.json'), 'utf-8')) as {
        dependencies: Record<string, string>;
      };

      const catalog = await loadCatalog(monorepoRoot);
      const coreDependencies = resolveCatalogVersions(corePackageJson.dependencies, catalog);
      const cliDependencies = resolveCatalogVersions(cliPackageJson.dependencies, catalog);

      const publishPackageJson = {
        name: 'typebase',
        version,
        description: 'A type-safe backend you write as TypeScript files inside your existing app.',
        license: 'MIT',
        homepage: 'https://typebase.io',
        repository: {
          type: 'git',
          url: 'git+https://github.com/typebase-io/monorepo.git',
        },
        bugs: {
          url: 'https://github.com/typebase-io/monorepo/issues',
        },
        keywords: ['typebase', 'typebase-io', 'typescript', 'backend', 'cli', 'api', 'database', 'auth', 'drizzle', 'better-auth', 'orpc'],
        engines: {
          node: '>=20',
        },
        type: 'module',
        bin: {
          'typebase-io-cli': './dist/bin/typebase.js',
          'typebase-io-cli-cjs': './dist/bin/typebase.cjs',
        },
        exports: {
          './client': {
            types: './dist/types/src/client/index.d.ts',
            import: './dist/esm/src/client/index.js',
            require: './dist/cjs/src/client/index.js',
          },
          './client/auth/nextjs': {
            types: './dist/types/src/client/auth/nextjs/index.d.ts',
            import: './dist/esm/src/client/auth/nextjs/index.js',
            require: './dist/cjs/src/client/auth/nextjs/index.js',
          },
          './client/auth/react': {
            types: './dist/types/src/client/auth/react/index.d.ts',
            import: './dist/esm/src/client/auth/react/index.js',
            require: './dist/cjs/src/client/auth/react/index.js',
          },
          './client/auth/svelte': {
            types: './dist/types/src/client/auth/svelte/index.d.ts',
            import: './dist/esm/src/client/auth/svelte/index.js',
            require: './dist/cjs/src/client/auth/svelte/index.js',
          },
          './client/auth/svelte-kit': {
            types: './dist/types/src/client/auth/svelte-kit/index.d.ts',
            import: './dist/esm/src/client/auth/svelte-kit/index.js',
            require: './dist/cjs/src/client/auth/svelte-kit/index.js',
          },
          './client/auth/vue': {
            types: './dist/types/src/client/auth/vue/index.d.ts',
            import: './dist/esm/src/client/auth/vue/index.js',
            require: './dist/cjs/src/client/auth/vue/index.js',
          },
          './client/auth/nuxt': {
            types: './dist/types/src/client/auth/nuxt/index.d.ts',
            import: './dist/esm/src/client/auth/nuxt/index.js',
            require: './dist/cjs/src/client/auth/nuxt/index.js',
          },
          './client/auth-plugins': {
            types: './dist/types/src/client/auth/plugins.d.ts',
            import: './dist/esm/src/client/auth/plugins.js',
            require: './dist/cjs/src/client/auth/plugins.js',
          },
          './db': {
            types: './dist/types/src/db/index.d.ts',
            import: './dist/esm/src/db/index.js',
            require: './dist/cjs/src/db/index.js',
          },
          './server': {
            types: './dist/types/src/server/index.d.ts',
            import: './dist/esm/src/server/index.js',
            require: './dist/cjs/src/server/index.js',
          },
          './server/auth-plugins': {
            types: './dist/types/src/server/auth/plugins.d.ts',
            import: './dist/esm/src/server/auth/plugins.js',
            require: './dist/cjs/src/server/auth/plugins.js',
          },
        },
        dependencies: {
          ...coreDependencies,
          '@neondatabase/api-client': cliDependencies['@neondatabase/api-client'],
          'drizzle-kit': cliDependencies['drizzle-kit'],
          'drizzle-orm': cliDependencies['drizzle-orm'],
          esbuild: cliDependencies.esbuild,
          pg: cliDependencies.pg,
        },
        peerDependencies: corePackageJson.peerDependencies,
        peerDependenciesMeta: corePackageJson.peerDependenciesMeta,
        files: ['dist'],
      };

      await writeFile(path.join(publishDir, 'library', 'package.json'), `${JSON.stringify(publishPackageJson, null, 2)}\n`);
      await cp(path.join(monorepoRoot, 'README.md'), path.join(libraryDir, 'README.md'));
      await cp(path.join(monorepoRoot, 'LICENSE'), path.join(libraryDir, 'LICENSE'));

      spinner.succeed(chalk.green(`Done! Publishable package at ${chalk.bold('publish/library/')}`));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
