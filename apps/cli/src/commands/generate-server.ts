import path from 'node:path';

import { Command, Option } from '@commander-js/extra-typings';
import ora from 'ora';

import { DEFAULT_ACTIONS_PATH, DEFAULT_AUTH_PATH, DEFAULT_SERVER_OUT_DIRS, serverAdapters, serverOutputs } from '#helpers/constants.ts';
import { buildServer } from '#helpers/generate-server/build-server.ts';
import { reportHostRequirements } from '#helpers/generate-server/report-host-requirements.ts';
import { runServerCommand } from '#helpers/generate-server/run-server-command.ts';
import { validateServerOptions } from '#helpers/generate-server/validate-server-options.ts';
import { validateServerPaths } from '#helpers/generate-server/validate-server-paths.ts';
import { watchServer } from '#helpers/generate-server/watch-server.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { parsePort } from '#helpers/shared/parse-port.ts';
import { runUntilStopped } from '#helpers/shared/run-until-stopped.ts';

export const generateServer = new Command('generate-server')
  .summary('Generate the server code locally')
  .description('Generate local server files in `<typebase>/_server/` from `<typebase>/actions` and `<typebase>/db`.')
  .allowExcessArguments(false)
  .addOption(new Option('--output <type>', 'Generate TypeScript, CommonJS or ESM server files').choices(serverOutputs))
  .addOption(new Option('--adapter <adapter>', 'HTTP adapter for the server').choices(serverAdapters))
  .option('--embedded', 'Generate an embedded server for your application to mount')
  .option('--out-dir <path>', 'Output directory for generated server files')
  .option('--actions-path <path>', 'Path an embedded server serves your actions at')
  .option('--auth-path <path>', 'Path an embedded server serves auth at')
  .option('--watch', 'Rebuild whenever a file inside the typebase directory changes. Press "x" or Ctrl+C to stop')
  .option('--command <command>', 'Command to run in the generated server directory after it is generated, restarted on every rebuild')
  .addOption(new Option('--port <number>', 'Port the generated server listens on').argParser(parsePort).conflicts('embedded'))
  .action(async (params) => {
    const { projectPath, server } = await getTypebaseConfig();

    const output = params.output ?? server.output;
    const adapter = params.adapter ?? server.adapter;
    const mode = (params.embedded ?? server.embedded) ? 'embedded' : 'standalone';
    const outDir = params.outDir ?? server.explicitOutDir ?? DEFAULT_SERVER_OUT_DIRS[mode];
    const port = params.port ?? server.port;

    validateServerOptions({ mode, options: params });

    const actionsPath = mode === 'embedded' ? (params.actionsPath ?? server.actionsPath) : DEFAULT_ACTIONS_PATH;
    const authPath = mode === 'embedded' ? (params.authPath ?? server.authPath) : DEFAULT_AUTH_PATH;

    if (mode === 'embedded') {
      validateServerPaths({ actionsPath, authPath });
    }

    const typebaseDirPath = path.resolve(projectPath);

    const serverCommand = params.command ? runServerCommand({ command: params.command, cwd: path.resolve(typebaseDirPath, outDir) }) : undefined;

    const build = async (signal?: AbortSignal, { rebuild = false } = {}) => {
      const spinner = rebuild ? ora('Regenerating...').start() : undefined;

      try {
        const { serverDistDirPath, seededEnvKeys, dependencies, devDependencies, envKeys } = await buildServer({
          projectPath,
          output,
          adapter,
          mode,
          outDir,
          configuredOutDir: server.outDir,
          port,
          actionsPath,
          authPath,
          signal,
          quiet: rebuild,
        });

        if (seededEnvKeys.length > 0) {
          ora().succeed(`${seededEnvKeys.join(', ')} copied from your project \`.env\`.`);
        }

        if (spinner) {
          spinner.succeed('Server regenerated!');
        } else {
          ora().succeed(`Server files generated in \`${path.relative(process.cwd(), serverDistDirPath) || serverDistDirPath}\`.`);
        }

        if (mode === 'embedded' && !rebuild) {
          await reportHostRequirements({ serverDistDirPath, adapter, output, dependencies, devDependencies, envKeys });
        }
      } catch (err) {
        spinner?.stop();

        throw err;
      }

      await serverCommand?.restart();
    };

    if (!params.watch) {
      await build();

      if (serverCommand) {
        await runUntilStopped(async (signal) => {
          const stopped = new Promise<void>((resolve) => {
            signal.addEventListener('abort', () => {
              resolve();
            });
          });

          await Promise.race([serverCommand.finished(), stopped]);

          await serverCommand.stop();
        });
      }

      return;
    }

    try {
      await runUntilStopped((signal) =>
        watchServer({
          build,
          dirPath: typebaseDirPath,
          ignoredDirPaths: [path.resolve(typebaseDirPath, outDir), path.join(typebaseDirPath, '_generated')],
          signal,
        })
      );
    } finally {
      await serverCommand?.stop();
    }
  });
