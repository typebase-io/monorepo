import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Command, InvalidArgumentError, Option } from '@commander-js/extra-typings';
import ora from 'ora';

import { serverAdapters } from '#helpers/constants.ts';
import { canReplaceServerDir } from '#helpers/generate-server/can-replace-server-dir.ts';
import { generateAction } from '#helpers/generate-server/generate-action.ts';
import { generateActionsFiles } from '#helpers/generate-server/generate-actions-files.ts';
import { generateAuthFile } from '#helpers/generate-server/generate-auth-file.ts';
import { generateDBFiles } from '#helpers/generate-server/generate-db-files.ts';
import { generateIndex } from '#helpers/generate-server/generate-index.ts';
import { generatePackageJson } from '#helpers/generate-server/generate-package-json.ts';
import { generatePackageManagerConfig } from '#helpers/generate-server/generate-package-manager-config.ts';
import { transpileTsToJs } from '#helpers/generate-server/transpile-ts-to-js.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getTrustedOriginsFromAuth } from '#helpers/shared/get-trusted-origins-from-auth.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { hasAuth } from '#helpers/shared/has-auth.ts';
import { hasDB } from '#helpers/shared/has-db.ts';
import { validateTypes } from '#helpers/shared/validate-types.ts';

export const generateServer = new Command('generate-server')
  .summary('Generate the server code locally')
  .description('Generate local server files in `<typebase>/_server/` from `<typebase>/actions` and `<typebase>/db`.')
  .allowExcessArguments(false)
  .addOption(new Option('--output <type>', 'Generate TypeScript, CommonJS or ESM server files').choices(['ts', 'esm', 'cjs']))
  .addOption(new Option('--adapter <adapter>', 'HTTP adapter for the server').choices(serverAdapters))
  .addOption(new Option('--skip-load-env', 'Omit dotenv/config import from generated server'))
  .option('--out-dir <path>', 'Output directory for generated server files')
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
    const skipLoadEnv = params.skipLoadEnv ?? server.skipLoadEnv;
    const outDir = params.outDir ?? server.outDir;
    const port = params.port ?? server.port;

    const typebaseDirPath = path.resolve(projectPath);

    const tsConfigFilePath = path.join(typebaseDirPath, 'tsconfig.json');
    const actionsDirPath = path.join(typebaseDirPath, 'actions');
    const schemaFilePath = path.join(typebaseDirPath, 'db', 'schema.ts');
    const authFilePath = path.join(typebaseDirPath, 'auth.ts');
    const dbDirPath = path.join(typebaseDirPath, 'db');

    const serverDistDirPath = path.resolve(typebaseDirPath, outDir);
    const canWriteFiles = await canReplaceServerDir(serverDistDirPath);

    if (!canWriteFiles) {
      throw new Error(
        `Refusing to replace \`${serverDistDirPath}\`: it is not empty and does not look like a previously generated Typebase server. Choose an empty or new directory, or delete it manually.`
      );
    }

    const tempServerDirPath = await fs.mkdtemp(path.join(tmpdir(), 'typebase-server-'));
    const tempDistDirPath = `${tempServerDirPath}-dist`;
    const tsConfigFileOutputPath = path.join(tempServerDirPath, 'tsconfig.json');
    const actionsOutputDirPath = path.join(tempServerDirPath, 'src', 'actions');
    const dbOutputDirPath = path.join(tempServerDirPath, 'src', 'db');
    const serverOutputDirPath = path.join(tempServerDirPath, 'src', '_generated');
    const indexFileOutPath = path.join(tempServerDirPath, 'src', 'index.ts');

    const includeDBFiles = hasDB(schemaFilePath);
    const includeAuthFile = hasAuth(authFilePath);

    validateTypes({
      dirPath: typebaseDirPath,
      tsConfigFilePath,
      skipErrors: false,
      quiet: false,
      excludeDirPaths: [serverDistDirPath, path.resolve(typebaseDirPath, server.outDir)],
    });

    const spinner = ora('Generating server files...').start();

    try {
      await generateTsConfig({ path: tsConfigFileOutputPath, addWarning: false });

      await generatePackageJson({
        adapter,
        typebaseDirPath,
        outputDirPath: tempServerDirPath,
        generation: output,
        skipLoadEnv,
        outDir,
        hasAuth: includeAuthFile,
      });

      await generatePackageManagerConfig({ outputDirPath: tempServerDirPath });
      await generateAction({ serverOutputDirPath, hasDB: includeDBFiles, hasAuth: includeAuthFile });
      await generateActionsFiles({ actionsDirPath, actionsOutputDirPath, useTs: output === 'ts' });

      if (includeDBFiles) {
        await generateDBFiles({ dbDirPath, dbOutputDirPath, useTs: output === 'ts', adapter });
      }

      if (includeAuthFile) {
        await generateAuthFile({ authFilePath, authOutputDirPath: path.join(tempServerDirPath, 'src'), useTs: output === 'ts', provider: undefined });
      }

      await generateIndex({
        adapter,
        port,
        skipLoadEnv,
        tsConfigFilePath,
        actionsDirPath,
        outputFilePath: indexFileOutPath,
        actionsOutputDirPath,
        generation: output,
        hasAuth: includeAuthFile,
        trustedOrigins: includeAuthFile ? getTrustedOriginsFromAuth(authFilePath) : [],
      });

      spinner.succeed('Server files generated!');

      let outputDirPath = tempServerDirPath;

      if (output !== 'ts') {
        transpileTsToJs({
          tsConfigFilePath: tsConfigFileOutputPath,
          cjs: output === 'cjs',
          quiet: false,
          tempServerDirPath,
          serverDistDirPath: tempDistDirPath,
        });

        await fs.cp(tempServerDirPath, tempDistDirPath, {
          recursive: true,
          filter: (src) => !src.startsWith(path.join(tempServerDirPath, 'src')) && src !== path.join(tempServerDirPath, 'tsconfig.json'),
        });

        outputDirPath = tempDistDirPath;
      }

      const previousEntries = await fs.readdir(serverDistDirPath).catch(() => []);

      for (const entry of previousEntries) {
        if (entry !== '.env' && entry !== 'node_modules') {
          await fs.rm(path.join(serverDistDirPath, entry), { recursive: true, force: true });
        }
      }

      await fs.cp(outputDirPath, serverDistDirPath, { recursive: true });
    } catch (err) {
      spinner.stop();
      throw err;
    } finally {
      await fs.rm(tempServerDirPath, { recursive: true, force: true });
      await fs.rm(tempDistDirPath, { recursive: true, force: true });
    }

    ora().succeed(`Server files generated in \`${path.relative(process.cwd(), serverDistDirPath) || serverDistDirPath}\`.`);
  });
