import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'path';

import { Command } from '@commander-js/extra-typings';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';

import { buildTypes } from '#helpers/shared/build-type.ts';
import { loadCatalog, resolveCatalogVersions } from '#helpers/shared/catalog.ts';
import { findMonorepoRoot } from '#helpers/shared/find-monorepo-root.ts';
import { getPublishableName } from '#helpers/shared/get-publishable-name.ts';
import { transpile } from '#helpers/shared/transpile.ts';

export const build = new Command('build')
  .summary('Builds an app of the monorepo')
  .allowExcessArguments(false)
  .option('--app <name>', 'App to build')
  .action(async ({ app }) => {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    const appsDir = path.join(monorepoRoot, 'apps');

    const entries = await readdir(appsDir, { withFileTypes: true });
    const apps = entries.filter((e) => e.isDirectory() && e.name !== 'build-apps').map((e) => e.name);

    if (apps.length === 0) {
      console.error(chalk.red('No apps found in apps/'));
      process.exit(1);
    }

    const selectedApp = app ?? (await select({ message: 'Available apps:', choices: apps.map((app) => ({ name: app, value: app })) }));

    if (!apps.includes(selectedApp)) {
      console.error(chalk.red(`App "${selectedApp}" not found. Available: ${apps.join(', ')}`));
      process.exit(1);
    }

    const rootDir = path.join(appsDir, selectedApp);
    const srcDir = path.join(rootDir, 'src');
    const packageJsonPath = path.join(rootDir, 'package.json');
    const readMePath = path.join(rootDir, 'README.md');
    const licensePath = path.join(monorepoRoot, 'LICENSE');
    const buildDir = path.join(rootDir, 'dist');
    const esmDir = path.join(buildDir, 'esm');
    const cjsDir = path.join(buildDir, 'cjs');
    const typesDir = path.join(buildDir, 'types');

    const publishAppDir = path.join(monorepoRoot, 'publish', selectedApp);
    const publishAppDistDir = path.join(publishAppDir, 'dist');
    const publishAppPackageJsonPath = path.join(publishAppDir, 'package.json');
    const publishAppReadMePath = path.join(publishAppDir, 'README.md');
    const publishAppLicensePath = path.join(publishAppDir, 'LICENSE');

    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
      name: string;
      imports?: Record<string, string[]>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const paths = packageJson.imports ?? {};
    const catalog = await loadCatalog(monorepoRoot);

    const spinner = ora(`Building ${chalk.cyan(selectedApp)}...`).start();

    process.chdir(rootDir);

    await mkdir(buildDir, { recursive: true });
    await rm(esmDir, { recursive: true, force: true });
    await rm(cjsDir, { recursive: true, force: true });
    await rm(typesDir, { recursive: true, force: true });

    await transpile({ rootDir, srcDir, outDir: esmDir, moduleType: 'nodenext', paths });
    await transpile({ rootDir, srcDir, outDir: cjsDir, moduleType: 'commonjs', paths });
    await buildTypes({ rootDir, srcDir, outDir: typesDir, paths });

    await rm(publishAppDir, { recursive: true, force: true });
    await mkdir(path.dirname(publishAppDistDir), { recursive: true });
    await cp(buildDir, publishAppDistDir, { recursive: true });
    await writeFile(
      publishAppPackageJsonPath,
      `${JSON.stringify(
        {
          ...packageJson,
          name: getPublishableName(packageJson.name),
          dependencies: packageJson.dependencies && resolveCatalogVersions(packageJson.dependencies, catalog),
          devDependencies: packageJson.devDependencies && resolveCatalogVersions(packageJson.devDependencies, catalog),
        },
        null,
        2
      )}\n`
    );
    await cp(readMePath, publishAppReadMePath);
    await cp(licensePath, publishAppLicensePath);

    spinner.succeed(chalk.green(`Done! Built ${chalk.bold(selectedApp)}`));
  });
