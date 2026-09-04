import path from 'node:path';

import chalk from 'chalk';

import { SERVER_MARKER_FILE_NAME, type ServerAdapter, type ServerOutput } from '#helpers/constants.ts';
import { embeddedMountSnippet } from '#helpers/generate-server/embedded-mount-snippet.ts';
import { getDependencyInstallCommand } from '#helpers/generate-server/get-dependency-install-command.ts';
import { validateHostDependencies } from '#helpers/generate-server/validate-host-dependencies.ts';
import { getPackageManager } from '#helpers/shared/get-package-manager.ts';

export const reportHostRequirements = async ({
  serverDistDirPath,
  adapter,
  output,
  dependencies,
  devDependencies,
  envKeys,
}: {
  serverDistDirPath: string;
  adapter: ServerAdapter;
  output: ServerOutput;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  envKeys: string[];
}) => {
  console.log(`\n${chalk.bold.cyan('Embedded server requirements')}`);

  const { dependenciesToInstall, hostDirPath } = await validateHostDependencies({
    hostDirPath: path.dirname(serverDistDirPath),
    dependencies: { ...devDependencies, ...dependencies },
  });

  const packageManager = await getPackageManager(hostDirPath);

  const commands = [
    getDependencyInstallCommand({
      packageManager,
      dependencies: Object.fromEntries(Object.entries(dependenciesToInstall).filter(([name]) => name in dependencies)),
      development: false,
    }),
    getDependencyInstallCommand({
      packageManager,
      dependencies: Object.fromEntries(Object.entries(dependenciesToInstall).filter(([name]) => !(name in dependencies))),
      development: true,
    }),
  ].filter((command) => command !== undefined);

  const relativeServerPath = path
    .relative(process.cwd(), path.join(serverDistDirPath, 'src', 'server.js'))
    .split(path.sep)
    .join('/');

  const importPath = relativeServerPath.startsWith('../') ? relativeServerPath : `./${relativeServerPath}`;
  const markerPath = path.relative(process.cwd(), path.join(serverDistDirPath, SERVER_MARKER_FILE_NAME)).split(path.sep).join('/');

  console.log(
    [
      '',
      commands.length > 0
        ? `${chalk.bold('Install missing or incompatible dependencies in the host package:')}\n${commands.map((command) => chalk.green(command)).join('\n')}`
        : chalk.green('All required dependencies are declared in the host package.'),
      '',
      envKeys.length > 0
        ? `${chalk.bold('Required Environment keys:')} ${chalk.cyan(envKeys.join(', '))}\n${chalk.dim('Load these in your host before importing the embedded server.')}`
        : `${chalk.bold('Required Environment keys:')} none.`,
      '',
      chalk.yellow("Cross-origin headers are your host application's responsibility. Configure its CORS policy for your clients."),
      '',
      chalk.bold('Mount from your project root (adjust the import for your entry point):'),
      chalk.green(embeddedMountSnippet({ adapter, output, importPath })),
      '',
      chalk.dim(`Dependency and environment details: ${markerPath}`),
      '',
    ].join('\n')
  );
};
