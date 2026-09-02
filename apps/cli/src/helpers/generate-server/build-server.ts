import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import ora from 'ora';

import { type ServerAdapter, type ServerOutput } from '#helpers/constants.ts';
import { canReplaceServerDir } from '#helpers/generate-server/can-replace-server-dir.ts';
import { copyServerAssets } from '#helpers/generate-server/copy-server-assets.ts';
import { generateAction } from '#helpers/generate-server/generate-action.ts';
import { generateActionsFiles } from '#helpers/generate-server/generate-actions-files.ts';
import { generateAuthFile } from '#helpers/generate-server/generate-auth-file.ts';
import { generateDBFiles } from '#helpers/generate-server/generate-db-files.ts';
import { generateEnvFile } from '#helpers/generate-server/generate-env-file.ts';
import { generateIndex } from '#helpers/generate-server/generate-index.ts';
import { generatePackageJson } from '#helpers/generate-server/generate-package-json.ts';
import { generatePackageManagerConfig } from '#helpers/generate-server/generate-package-manager-config.ts';
import { generatePublisherFile } from '#helpers/generate-server/generate-publisher-file.ts';
import { seedServerEnv } from '#helpers/generate-server/seed-server-env.ts';
import { transpileTsToJs } from '#helpers/generate-server/transpile-ts-to-js.ts';
import { canonicalizePath } from '#helpers/shared/canonicalize-path.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getTrustedOriginsFromAuth } from '#helpers/shared/get-trusted-origins-from-auth.ts';
import { resolveProjectShapeOrThrow } from '#helpers/shared/resolve-project-shape-or-throw.ts';
import { validateTypes } from '#helpers/shared/validate-types.ts';

export const buildServer = async ({
  projectPath,
  output,
  adapter,
  outDir,
  configuredOutDir,
  port,
  signal,
  quiet = false,
}: {
  projectPath: string;
  output: ServerOutput;
  adapter: ServerAdapter;
  outDir: string;
  configuredOutDir: string;
  port: number;
  signal?: AbortSignal;
  quiet?: boolean;
}) => {
  const typebaseDirPath = path.resolve(projectPath);

  const tsConfigFilePath = path.join(typebaseDirPath, 'tsconfig.json');
  const actionsDirPath = path.join(typebaseDirPath, 'actions');
  const schemaFilePath = path.join(typebaseDirPath, 'db', 'schema.ts');
  const authFilePath = path.join(typebaseDirPath, 'auth.ts');
  const envFilePath = path.join(typebaseDirPath, 'env.ts');
  const publisherFilePath = path.join(typebaseDirPath, 'publisher.ts');
  const dbDirPath = path.join(typebaseDirPath, 'db');
  const generatedDirPath = path.join(typebaseDirPath, '_generated');
  const dbTypesOutputPath = path.join(generatedDirPath, 'db.d.ts');

  const serverDistDirPath = path.resolve(typebaseDirPath, outDir);
  const canonicalTypebaseDirPath = canonicalizePath(typebaseDirPath);
  const canonicalServerDistDirPath = canonicalizePath(serverDistDirPath);

  if (canonicalServerDistDirPath === canonicalTypebaseDirPath || canonicalTypebaseDirPath.startsWith(`${canonicalServerDistDirPath}${path.sep}`)) {
    throw new Error(
      `Refusing to generate into \`${serverDistDirPath}\`: it contains your typebase directory, and generating replaces the output directory. Choose a directory inside \`${typebaseDirPath}\`, such as the default \`_server\`.`
    );
  }

  for (const sourceDirName of ['actions', 'db'] as const) {
    const sourceDirPath = canonicalizePath(path.join(typebaseDirPath, sourceDirName));

    if (canonicalServerDistDirPath === sourceDirPath || canonicalServerDistDirPath.startsWith(`${sourceDirPath}${path.sep}`)) {
      throw new Error(
        `Refusing to generate into \`${serverDistDirPath}\`: it is inside \`${sourceDirName}/\`, which is copied into the server, so the next run would treat the generated files as your sources. Choose a directory outside \`${sourceDirName}/\`, such as the default \`_server\`.`
      );
    }
  }

  const canWriteFiles = await canReplaceServerDir(serverDistDirPath);

  if (!canWriteFiles) {
    throw new Error(
      `Refusing to replace \`${serverDistDirPath}\`: it is not empty and does not look like a previously generated Typebase server. Choose an empty or new directory, or delete it manually.`
    );
  }

  let spinner: ReturnType<typeof ora> | undefined;

  const tempServerDirPath = await fs.mkdtemp(path.join(tmpdir(), 'typebase-server-'));
  const tempDistDirPath = `${tempServerDirPath}-dist`;
  const tsConfigFileOutputPath = path.join(tempServerDirPath, 'tsconfig.json');
  const actionsOutputDirPath = path.join(tempServerDirPath, 'src', 'actions');
  const dbOutputDirPath = path.join(tempServerDirPath, 'src', 'db');
  const serverOutputDirPath = path.join(tempServerDirPath, 'src', '_generated');
  const indexFileOutPath = path.join(tempServerDirPath, 'src', 'index.ts');

  let envKeys: string[] = [];
  let seededEnvKeys: string[] = [];

  try {
    const {
      hasDB: includeDBFiles,
      hasAuth: includeAuthFile,
      hasPublisher: includePublisherFile,
      needsEnvModule: includeEnvFile,
    } = resolveProjectShapeOrThrow({ schemaFilePath, authFilePath, envFilePath, publisherFilePath });

    spinner = quiet ? undefined : ora('Generating types...').start();

    await Promise.all([
      generateDBTypes({ schemaFilePath, authFilePath, outFilePath: dbTypesOutputPath }),
      generateServerTypes({ tsConfigFilePath, schemaFilePath, authFilePath, envFilePath, publisherFilePath, actionsDirPath, generatedDirPath }),
    ]);

    spinner?.succeed('Types generated!');

    signal?.throwIfAborted();

    validateTypes({
      dirPath: typebaseDirPath,
      tsConfigFilePath,
      skipErrors: false,
      quiet,
      excludeDirPaths: [generatedDirPath, serverDistDirPath, path.resolve(typebaseDirPath, configuredOutDir)].filter((excluded) =>
        excluded.startsWith(`${typebaseDirPath}${path.sep}`)
      ),
    });

    signal?.throwIfAborted();

    spinner = quiet ? undefined : ora('Generating server files...').start();

    await generateTsConfig({ path: tsConfigFileOutputPath, addWarning: false });

    await generatePackageJson({
      adapter,
      typebaseDirPath,
      outputDirPath: tempServerDirPath,
      generation: output,
      outDir,
      configuredOutDir,
      hasAuth: includeAuthFile,
      hasEnv: includeEnvFile,
    });

    await generatePackageManagerConfig({ outputDirPath: tempServerDirPath });

    if (includeEnvFile) {
      envKeys = await generateEnvFile({
        envFilePath,
        envOutputDirPath: path.join(tempServerDirPath, 'src'),
        adapter,
        hasDB: includeDBFiles,
        hasAuth: includeAuthFile,
        useTs: output === 'ts',
        target: undefined,
      });
    }

    signal?.throwIfAborted();

    if (includePublisherFile) {
      await generatePublisherFile({
        publisherFilePath,
        publisherOutputDirPath: path.join(tempServerDirPath, 'src'),
        provider: includePublisherFile,
        useTs: output === 'ts',
      });
    }

    await generateAction({
      serverOutputDirPath,
      hasDB: includeDBFiles,
      hasAuth: includeAuthFile,
      hasEnv: includeEnvFile,
      hasPublisher: includePublisherFile !== false,
    });

    if (existsSync(actionsDirPath)) {
      await generateActionsFiles({ actionsDirPath, actionsOutputDirPath, useTs: output === 'ts' });
    } else {
      await fs.mkdir(actionsOutputDirPath, { recursive: true });
    }

    if (includeDBFiles) {
      await generateDBFiles({ dbDirPath, dbOutputDirPath, useTs: output === 'ts', adapter });
    }

    if (includeAuthFile) {
      await generateAuthFile({ authFilePath, authOutputDirPath: path.join(tempServerDirPath, 'src'), useTs: output === 'ts', provider: undefined });
    }

    await generateIndex({
      adapter,
      port,
      tsConfigFilePath,
      actionsDirPath,
      outputFilePath: indexFileOutPath,
      actionsOutputDirPath,
      generation: output,
      hasAuth: includeAuthFile,
      hasEnv: includeEnvFile,
      trustedOrigins: includeAuthFile ? getTrustedOriginsFromAuth(authFilePath) : [],
    });

    spinner?.stop();

    signal?.throwIfAborted();

    let outputDirPath = tempServerDirPath;

    if (output !== 'ts') {
      transpileTsToJs({
        tsConfigFilePath: tsConfigFileOutputPath,
        cjs: output === 'cjs',
        quiet,
        tempServerDirPath,
        serverDistDirPath: tempDistDirPath,
      });

      await fs.cp(tempServerDirPath, tempDistDirPath, {
        recursive: true,
        filter: (src) => !src.startsWith(path.join(tempServerDirPath, 'src')) && src !== path.join(tempServerDirPath, 'tsconfig.json'),
      });

      await copyServerAssets({ tempServerDirPath, serverDistDirPath: tempDistDirPath });

      outputDirPath = tempDistDirPath;
    }

    signal?.throwIfAborted();

    const previousEntries = await fs.readdir(serverDistDirPath).catch(() => []);

    for (const entry of previousEntries) {
      if (entry !== '.env' && entry !== 'node_modules') {
        await fs.rm(path.join(serverDistDirPath, entry), { recursive: true, force: true });
      }
    }

    await fs.cp(outputDirPath, serverDistDirPath, { recursive: true });

    seededEnvKeys = await seedServerEnv({ serverDistDirPath, keys: envKeys });
  } catch (err) {
    spinner?.stop();
    throw err;
  } finally {
    await fs.rm(tempServerDirPath, { recursive: true, force: true });
    await fs.rm(tempDistDirPath, { recursive: true, force: true });
  }

  return { serverDistDirPath, seededEnvKeys };
};
