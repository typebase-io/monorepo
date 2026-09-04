import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import ora from 'ora';

import {
  DEFAULT_AUTH_PATH,
  DEFAULT_SERVER_OUT_DIRS,
  SERVER_MARKER_FILE_NAME,
  type ServerAdapter,
  type ServerMode,
  type ServerOutput,
} from '#helpers/constants.ts';
import { canReplaceServerDir } from '#helpers/generate-server/can-replace-server-dir.ts';
import { copyServerAssets } from '#helpers/generate-server/copy-server-assets.ts';
import { generateAction } from '#helpers/generate-server/generate-action.ts';
import { generateActionsFiles } from '#helpers/generate-server/generate-actions-files.ts';
import { generateAuthFile } from '#helpers/generate-server/generate-auth-file.ts';
import { generateDBFiles } from '#helpers/generate-server/generate-db-files.ts';
import { generateEnvFile } from '#helpers/generate-server/generate-env-file.ts';
import { generateMarkerFile } from '#helpers/generate-server/generate-marker-file.ts';
import { generatePackageJson } from '#helpers/generate-server/generate-package-json.ts';
import { generatePackageManagerConfig } from '#helpers/generate-server/generate-package-manager-config.ts';
import { generatePublisherFile } from '#helpers/generate-server/generate-publisher-file.ts';
import { generateServerFiles } from '#helpers/generate-server/generate-server-files.ts';
import { seedServerEnv } from '#helpers/generate-server/seed-server-env.ts';
import { transpileTsToJs } from '#helpers/generate-server/transpile-ts-to-js.ts';
import { canonicalizePath } from '#helpers/shared/canonicalize-path.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getBasePathFromAuth } from '#helpers/shared/get-base-path-from-auth.ts';
import { getTrustedOriginsFromAuth } from '#helpers/shared/get-trusted-origins-from-auth.ts';
import { normalizeServerPath } from '#helpers/shared/normalize-server-path.ts';
import { resolveProjectShapeOrThrow } from '#helpers/shared/resolve-project-shape-or-throw.ts';
import { rewriteImportExtensionsToJs } from '#helpers/shared/rewrite-import-extensions-to-js.ts';
import { validateTypes } from '#helpers/shared/validate-types.ts';

export const buildServer = async ({
  projectPath,
  output,
  adapter,
  mode,
  outDir,
  configuredOutDir,
  port,
  actionsPath,
  authPath: configuredAuthPath,
  authBaseURL,
  signal,
  quiet = false,
}: {
  projectPath: string;
  output: ServerOutput;
  adapter: ServerAdapter;
  mode: ServerMode;
  outDir: string;
  configuredOutDir: string;
  port: number;
  actionsPath: string;
  authPath: string;
  authBaseURL?: string;
  signal?: AbortSignal;
  quiet?: boolean;
}) => {
  const authPath = normalizeServerPath(configuredAuthPath);
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
      `Refusing to generate into \`${serverDistDirPath}\`: it contains your typebase directory, and generating replaces the output directory. Choose a directory inside \`${typebaseDirPath}\`, such as the default \`${DEFAULT_SERVER_OUT_DIRS[mode]}\`.`
    );
  }

  for (const sourceDirName of ['actions', 'db'] as const) {
    const sourceDirPath = canonicalizePath(path.join(typebaseDirPath, sourceDirName));

    if (canonicalServerDistDirPath === sourceDirPath || canonicalServerDistDirPath.startsWith(`${sourceDirPath}${path.sep}`)) {
      throw new Error(
        `Refusing to generate into \`${serverDistDirPath}\`: it is inside \`${sourceDirName}/\`, which is copied into the server, so the next run would treat the generated files as your sources. Choose a directory outside \`${sourceDirName}/\`, such as the default \`${DEFAULT_SERVER_OUT_DIRS[mode]}\`.`
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
  const srcOutputDirPath = path.join(tempServerDirPath, 'src');
  const actionsOutputDirPath = path.join(srcOutputDirPath, 'actions');
  const dbOutputDirPath = path.join(srcOutputDirPath, 'db');
  const serverOutputDirPath = path.join(srcOutputDirPath, '_generated');

  let envKeys: string[] = [];
  let seededEnvKeys: string[] = [];

  try {
    const {
      hasDB: includeDBFiles,
      hasAuth: includeAuthFile,
      hasPublisher: includePublisherFile,
      needsEnvModule: includeEnvFile,
    } = resolveProjectShapeOrThrow({ schemaFilePath, authFilePath, envFilePath, publisherFilePath });

    const developerBasePath = mode === 'embedded' && includeAuthFile ? getBasePathFromAuth(authFilePath) : undefined;

    if (!quiet && typeof developerBasePath === 'object') {
      ora().warn(`\`auth.ts\` may override \`${authPath}\` with a dynamic \`basePath\`; the generated auth route follows its runtime value.`);
    } else if (!quiet && typeof developerBasePath === 'string' && normalizeServerPath(developerBasePath) !== normalizeServerPath(authPath)) {
      ora().warn(
        `\`auth.ts\` sets \`basePath: ${JSON.stringify(developerBasePath)}\`, so the generated server serves auth there rather than at \`${authPath}\`.`
      );
    }

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

    const injectedBasePath = authPath === DEFAULT_AUTH_PATH && typeof developerBasePath !== 'object' ? undefined : authPath;
    const registeredAuthPath = developerBasePath ?? authPath;

    spinner = quiet ? undefined : ora('Generating server files...').start();

    await generateTsConfig({ path: tsConfigFileOutputPath, addWarning: false });

    const { dependencies, devDependencies } = await generatePackageJson({
      adapter,
      mode,
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
        envOutputDirPath: srcOutputDirPath,
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
        publisherOutputDirPath: srcOutputDirPath,
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
      await generateAuthFile({
        authFilePath,
        authOutputDirPath: srcOutputDirPath,
        useTs: output === 'ts',
        baseURL: authBaseURL === undefined ? undefined : { url: authBaseURL },
        basePath: injectedBasePath,
      });
    }

    await generateServerFiles({
      adapter,
      mode,
      port,
      tsConfigFilePath,
      actionsDirPath,
      outputDirPath: srcOutputDirPath,
      actionsOutputDirPath,
      generation: output,
      hasAuth: includeAuthFile,
      hasEnv: includeEnvFile,
      trustedOrigins: includeAuthFile ? getTrustedOriginsFromAuth(authFilePath) : [],
      actionsPath,
      authPath: registeredAuthPath,
    });

    if (mode === 'embedded' && output === 'ts') {
      await rewriteImportExtensionsToJs(srcOutputDirPath);
    }

    await generateMarkerFile({
      outputDirPath: tempServerDirPath,
      adapter,
      mode,
      dependencies,
      devDependencies,
      envKeys,
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
        filter: (src) => !src.startsWith(srcOutputDirPath) && src !== path.join(tempServerDirPath, 'tsconfig.json'),
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

    if (mode === 'embedded') {
      await fs.cp(path.join(outputDirPath, 'src'), path.join(serverDistDirPath, 'src'), { recursive: true });
      await fs.cp(path.join(outputDirPath, SERVER_MARKER_FILE_NAME), path.join(serverDistDirPath, SERVER_MARKER_FILE_NAME));
    } else {
      await fs.cp(outputDirPath, serverDistDirPath, { recursive: true });
    }

    if (mode === 'standalone') {
      seededEnvKeys = await seedServerEnv({ serverDistDirPath, keys: envKeys });
    }

    return { serverDistDirPath, seededEnvKeys, dependencies, devDependencies, envKeys };
  } catch (err) {
    spinner?.stop();
    throw err;
  } finally {
    await fs.rm(tempServerDirPath, { recursive: true, force: true });
    await fs.rm(tempDistDirPath, { recursive: true, force: true });
  }
};
