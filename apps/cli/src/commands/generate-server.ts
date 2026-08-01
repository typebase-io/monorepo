import path from 'node:path';

import { Command, InvalidArgumentError, Option } from '@commander-js/extra-typings';
import ora from 'ora';

import { serverAdapters } from '#helpers/constants.ts';
import { buildServer } from '#helpers/generate-server/build-server.ts';
import { watchServer } from '#helpers/generate-server/watch-server.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { runUntilStopped } from '#helpers/shared/run-until-stopped.ts';

export const generateServer = new Command('generate-server')
  .summary('Generate the server code locally')
  .description('Generate local server files in `<typebase>/_server/` from `<typebase>/actions` and `<typebase>/db`.')
  .allowExcessArguments(false)
  .addOption(new Option('--output <type>', 'Generate TypeScript, CommonJS or ESM server files').choices(['ts', 'esm', 'cjs']))
  .addOption(new Option('--adapter <adapter>', 'HTTP adapter for the server').choices(serverAdapters))
  .option('--out-dir <path>', 'Output directory for generated server files')
  .option('--watch', 'Rebuild whenever a file inside the typebase directory changes. Press "x" or Ctrl+C to stop')
  .option('--port <number>', 'Port the generated server listens on', (value) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new InvalidArgumentError('Port must be a positive integer.');
    }

    return parsed;
  })
  .action(async (params) => {
    const { projectPath, server } = await getTypebaseConfig();

    const output = params.output ?? server.output;
    const adapter = params.adapter ?? server.adapter;
    const outDir = params.outDir ?? server.outDir;
    const port = params.port ?? server.port;

    const typebaseDirPath = path.resolve(projectPath);

    const build = async (signal?: AbortSignal, { rebuild = false } = {}) => {
      const spinner = rebuild ? ora('Regenerating...').start() : undefined;

      try {
        const { serverDistDirPath } = await buildServer({
          projectPath,
          output,
          adapter,
          outDir,
          configuredOutDir: server.outDir,
          port,
          signal,
          quiet: rebuild,
        });

        if (spinner) {
          spinner.succeed('Server regenerated!');

          return;
        }

        ora().succeed(`Server files generated in \`${path.relative(process.cwd(), serverDistDirPath) || serverDistDirPath}\`.`);
      } catch (err) {
        spinner?.stop();

        throw err;
      }
    };

    if (!params.watch) {
      await build();

      return;
    }

    await runUntilStopped((signal) =>
      watchServer({
        build,
        dirPath: typebaseDirPath,
        ignoredDirPaths: [path.resolve(typebaseDirPath, outDir), path.join(typebaseDirPath, '_generated')],
        signal,
      })
    );
  });
