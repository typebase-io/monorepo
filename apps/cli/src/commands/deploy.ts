import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Command, InvalidArgumentError, Option } from '@commander-js/extra-typings';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { match } from 'ts-pattern';

import { getAndSaveAuthSecret } from '#helpers/auth/get-and-save-auth-secret.ts';
import { type ServerAdapter, serverProviders } from '#helpers/constants.ts';
import { neon } from '#helpers/db/neon/index.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';
import { cloudflare } from '#helpers/deploy/cloudflare/index.ts';
import { deno } from '#helpers/deploy/deno/index.ts';
import { vercel } from '#helpers/deploy/vercel/index.ts';
import { getCloudflareEnvVar } from '#helpers/env/cloudflare.ts';
import { getDenoEnvVar } from '#helpers/env/deno.ts';
import { getVercelEnvVar } from '#helpers/env/vercel.ts';
import { generateAction } from '#helpers/generate-server/generate-action.ts';
import { generateActionsFiles } from '#helpers/generate-server/generate-actions-files.ts';
import { generateAuthFile } from '#helpers/generate-server/generate-auth-file.ts';
import { generateDBFiles } from '#helpers/generate-server/generate-db-files.ts';
import { generateEnvFile } from '#helpers/generate-server/generate-env-file.ts';
import { generateIndex } from '#helpers/generate-server/generate-index.ts';
import { generatePackageJson } from '#helpers/generate-server/generate-package-json.ts';
import { generatePackageManagerConfig } from '#helpers/generate-server/generate-package-manager-config.ts';
import { transpileTsToJs } from '#helpers/generate-server/transpile-ts-to-js.ts';
import { streamLogs } from '#helpers/logs/stream-logs.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getTrustedOriginsFromAuth } from '#helpers/shared/get-trusted-origins-from-auth.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { resolveProjectShapeOrThrow } from '#helpers/shared/resolve-project-shape-or-throw.ts';
import { validateTypes } from '#helpers/shared/validate-types.ts';
import { writeEnvFile } from '#helpers/shared/write-env-file.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

export const deploy = new Command('deploy')
  .summary('Deploy your server')
  .description('Generate and deploy your Typebase server, making it available at a stable dev URL.')
  .argument('<target>', 'Deployment target (dev or prod)', (target) => {
    if (!['dev', 'prod'].includes(target)) {
      throw new InvalidArgumentError('Target must be "dev" or "prod".');
    }

    return target as 'dev' | 'prod';
  })
  .addOption(new Option('--provider <provider>', 'Deployment provider').choices(serverProviders))
  .option('--logs', 'Stream the server logs once the deployment is live')
  .allowExcessArguments(false)
  .action(async (target, options) => {
    const { projectPath, serverProvider, server } = await getTypebaseConfig();

    const provider = await match(options.provider)
      .with(undefined, () => {
        if (serverProvider) {
          return serverProvider;
        }

        return select({
          message: 'Select a deploy provider:',
          choices: serverProviders.map((provider) => ({ name: provider, value: provider })),
        });
      })
      .otherwise((provider) => provider);

    if (!serverProvider) {
      await writeTypebaseConfig({ serverProvider: provider });
      ora().succeed('Provider saved to typebase.json.');
    }

    const output = 'esm';
    const skipLoadEnv = provider === 'cloudflare';
    const outDir = 'build';

    const adapter = match(provider)
      .returnType<ServerAdapter>()
      .with('vercel', () => 'hono')
      .with('deno', () => 'deno')
      .with('cloudflare', () => 'cloudflare')
      .exhaustive();

    const typebaseDirPath = path.resolve(projectPath);
    const tsConfigFilePath = path.join(typebaseDirPath, 'tsconfig.json');
    const actionsDirPath = path.join(typebaseDirPath, 'actions');
    const schemaFilePath = path.join(typebaseDirPath, 'db', 'schema.ts');
    const authFilePath = path.join(typebaseDirPath, 'auth.ts');
    const envFilePath = path.join(typebaseDirPath, 'env.ts');
    const dbDirPath = path.join(typebaseDirPath, 'db');

    const tempServerDirPath = await fs.mkdtemp(path.join(tmpdir(), 'typebase-server-'));
    const serverDistDirPath = path.resolve(tempServerDirPath, outDir);
    const tsConfigFileOutputPath = path.join(tempServerDirPath, 'tsconfig.json');
    const actionsOutputDirPath = path.join(tempServerDirPath, 'src', 'actions');
    const dbOutputDirPath = path.join(tempServerDirPath, 'src', 'db');
    const serverOutputDirPath = path.join(tempServerDirPath, 'src', '_generated');
    const indexFileOutPath = path.join(tempServerDirPath, 'src', 'index.ts');

    const generatedDirPath = path.join(typebaseDirPath, '_generated');
    const dbTypesOutputPath = path.join(generatedDirPath, 'db.d.ts');

    const {
      hasDB: includeDBFiles,
      hasAuth: includeAuthFile,
      needsEnvModule: includeEnvFile,
    } = resolveProjectShapeOrThrow({ schemaFilePath, authFilePath, envFilePath });

    const env: { key: string; value: string; secret: boolean }[] = [];
    let hadDatabaseUrl = false;
    let hadAuthSecret = false;

    validateTypes({
      dirPath: typebaseDirPath,
      tsConfigFilePath,
      skipErrors: false,
      quiet: false,
      excludeDirPaths: [path.resolve(typebaseDirPath, server.outDir)],
    });

    const codegenSpinner = ora('Generating types...').start();

    await Promise.all([
      generateDBTypes({ schemaFilePath, authFilePath, outFilePath: dbTypesOutputPath }),
      generateServerTypes({ tsConfigFilePath, schemaFilePath, authFilePath, envFilePath, actionsDirPath, generatedDirPath }),
    ]);

    codegenSpinner.succeed('Types generated!');

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
        hasEnv: includeEnvFile,
      });

      const generatedFile = await generatePackageManagerConfig({ outputDirPath: tempServerDirPath });

      if (includeEnvFile) {
        await generateEnvFile({
          envFilePath,
          envOutputDirPath: path.join(tempServerDirPath, 'src'),
          adapter,
          hasDB: includeDBFiles,
          hasAuth: includeAuthFile,
          useTs: false,
          target,
        });
      }

      await generateAction({ serverOutputDirPath, hasDB: includeDBFiles, hasAuth: includeAuthFile, hasEnv: includeEnvFile });
      await generateActionsFiles({ actionsDirPath, actionsOutputDirPath, useTs: false });

      if (includeDBFiles) {
        await generateDBFiles({ dbDirPath, dbOutputDirPath, useTs: false, adapter });
      }

      if (includeAuthFile) {
        await generateAuthFile({ authFilePath, authOutputDirPath: path.join(tempServerDirPath, 'src'), useTs: false, provider });
      }

      await generateIndex({
        adapter,
        port: 3000,
        skipLoadEnv,
        tsConfigFilePath,
        actionsDirPath,
        outputFilePath: indexFileOutPath,
        actionsOutputDirPath,
        generation: output,
        hasAuth: includeAuthFile,
        hasEnv: includeEnvFile,
        trustedOrigins: includeAuthFile ? getTrustedOriginsFromAuth(authFilePath) : [],
      });

      spinner.succeed('Server files generated!');

      transpileTsToJs({
        tsConfigFilePath: tsConfigFileOutputPath,
        cjs: false,
        quiet: false,
        tempServerDirPath,
        serverDistDirPath,
      });

      await Promise.all(
        ['package.json', ...(generatedFile ? [generatedFile] : [])].map((file) =>
          fs.copyFile(path.join(tempServerDirPath, file), path.join(serverDistDirPath, file))
        )
      );

      const { connectionUri } = includeDBFiles ? await neon({ target }) : { connectionUri: undefined };

      if (connectionUri) {
        await pushSchema({ serverDistDirPath, connectionUri });

        const databaseURL = await match(provider)
          .with('vercel', () => getVercelEnvVar({ key: 'DATABASE_URL', target }))
          .with('deno', () => getDenoEnvVar({ key: 'DATABASE_URL', target }))
          .with('cloudflare', () => getCloudflareEnvVar({ key: 'DATABASE_URL', target }))
          .exhaustive();

        hadDatabaseUrl = databaseURL === connectionUri;

        env.push({ key: 'DATABASE_URL', value: connectionUri, secret: true });
      }

      if (includeAuthFile) {
        const authSecret = await match(provider)
          .with('vercel', () => getVercelEnvVar({ key: 'BETTER_AUTH_SECRET', target }))
          .with('deno', () => getDenoEnvVar({ key: 'BETTER_AUTH_SECRET', target }))
          .with('cloudflare', () => getCloudflareEnvVar({ key: 'BETTER_AUTH_SECRET', target }))
          .exhaustive();

        hadAuthSecret = Boolean(authSecret);

        if (!hadAuthSecret) {
          const secret = await getAndSaveAuthSecret();

          env.push({ key: 'BETTER_AUTH_SECRET', value: secret, secret: true });
        }
      }

      const { deploymentId, url } = await match(provider)
        .with('vercel', () => vercel({ serverDirPath: serverDistDirPath, target, env }))
        .with('deno', () => deno({ serverDirPath: serverDistDirPath, target, env }))
        .with('cloudflare', () => cloudflare({ serverDirPath: serverDistDirPath, target, env }))
        .exhaustive();

      if (connectionUri && !hadDatabaseUrl) {
        ora().succeed(`DATABASE_URL set on ${provider}.`);
      }

      if (includeAuthFile && !hadAuthSecret) {
        ora().succeed(`BETTER_AUTH_SECRET set on ${provider}.`);
      }

      await writeEnvFile(target === 'prod' ? 'TYPEBASE_APP_URL' : 'TYPEBASE_APP_URL_DEV', url);

      console.log(chalk.green(`\nDeployment Id: ${deploymentId}`));
      console.log(chalk.green(`Deployment URL: ${url}`));
    } finally {
      spinner.stop();
      await fs.rm(tempServerDirPath, { recursive: true, force: true });
    }

    if (options.logs) {
      console.log(chalk.dim('\nStreaming logs. Press "x" or Ctrl+C to stop.'));

      await streamLogs({ target, provider });
    }
  });
