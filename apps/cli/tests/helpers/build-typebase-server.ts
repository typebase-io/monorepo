import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';

import { match } from 'ts-pattern';

import { type ServerAdapter, type ServerProvider } from '#helpers/constants.ts';
import { generateAction } from '#helpers/generate-server/generate-action.ts';
import { generateActionsFiles } from '#helpers/generate-server/generate-actions-files.ts';
import { generateAuthFile } from '#helpers/generate-server/generate-auth-file.ts';
import { generateDBFiles } from '#helpers/generate-server/generate-db-files.ts';
import { generateEnvFile } from '#helpers/generate-server/generate-env-file.ts';
import { generateIndex } from '#helpers/generate-server/generate-index.ts';
import { generatePackageJson } from '#helpers/generate-server/generate-package-json.ts';
import { generatePublisherFile } from '#helpers/generate-server/generate-publisher-file.ts';
import { transpileTsToJs } from '#helpers/generate-server/transpile-ts-to-js.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getTrustedOriginsFromAuth } from '#helpers/shared/get-trusted-origins-from-auth.ts';
import { hasAuth } from '#helpers/shared/has-auth.ts';
import { hasDB } from '#helpers/shared/has-db.ts';
import { hasEnv } from '#helpers/shared/has-env.ts';
import { resolveProjectShapeOrThrow } from '#helpers/shared/resolve-project-shape-or-throw.ts';

import { type TempDir } from '#tests/helpers/temp-dir.ts';

const NODE_BUILTINS = new Set(builtinModules);

export const buildTypebaseServer = async (tmp: TempDir, projectDir: string, options: { provider: ServerProvider }): Promise<string> => {
  const { provider } = options;
  const output = 'esm';

  const adapter = match(provider)
    .returnType<ServerAdapter>()
    .with('vercel', () => 'hono')
    .with('deno', () => 'deno')
    .with('cloudflare', () => 'cloudflare')
    .exhaustive();

  const schemaFilePath = path.join(projectDir, 'db', 'schema.ts');
  const authFilePath = path.join(projectDir, 'auth.ts');
  const envFilePath = path.join(projectDir, 'env.ts');
  const publisherFilePath = path.join(projectDir, 'publisher.ts');

  const includeDBFiles = hasDB(schemaFilePath);
  const includeAuthFile = hasAuth(authFilePath);
  const includeEnvFile = includeDBFiles || includeAuthFile || hasEnv(envFilePath);
  const { hasPublisher: publisherProvider } = resolveProjectShapeOrThrow({ schemaFilePath, authFilePath, envFilePath, publisherFilePath });

  const tempServerDir = path.join(tmp.path, 'temp-server');
  const serverDir = path.join(tmp.path, 'server');

  mkdirSync(path.join(tempServerDir, 'src'), { recursive: true });

  await generateTsConfig({ path: path.join(tempServerDir, 'tsconfig.json'), addWarning: false });

  await generatePackageJson({
    adapter,
    typebaseDirPath: projectDir,
    outputDirPath: tempServerDir,
    generation: output,
    outDir: 'build',
    hasAuth: includeAuthFile,
    hasEnv: includeEnvFile,
  });

  if (includeEnvFile) {
    await generateEnvFile({
      envFilePath,
      envOutputDirPath: path.join(tempServerDir, 'src'),
      adapter,
      hasDB: includeDBFiles,
      hasAuth: includeAuthFile,
      useTs: false,
      target: undefined,
    });
  }

  if (publisherProvider !== false) {
    await generatePublisherFile({
      publisherFilePath,
      publisherOutputDirPath: path.join(tempServerDir, 'src'),
      provider: publisherProvider,
      useTs: false,
    });
  }

  await generateAction({
    serverOutputDirPath: path.join(tempServerDir, 'src', '_generated'),
    hasDB: includeDBFiles,
    hasAuth: includeAuthFile,
    hasEnv: includeEnvFile,
    hasPublisher: publisherProvider !== false,
  });

  await generateActionsFiles({
    actionsDirPath: path.join(projectDir, 'actions'),
    actionsOutputDirPath: path.join(tempServerDir, 'src', 'actions'),
    useTs: false,
  });

  if (includeDBFiles) {
    await generateDBFiles({ dbDirPath: path.join(projectDir, 'db'), dbOutputDirPath: path.join(tempServerDir, 'src', 'db'), useTs: false, adapter });
  }

  if (includeAuthFile) {
    await generateAuthFile({ authFilePath, authOutputDirPath: path.join(tempServerDir, 'src'), useTs: false, provider });
  }

  await generateIndex({
    adapter,
    port: 3000,
    tsConfigFilePath: path.join(projectDir, 'tsconfig.json'),
    actionsDirPath: path.join(projectDir, 'actions'),
    outputFilePath: path.join(tempServerDir, 'src', 'index.ts'),
    actionsOutputDirPath: path.join(tempServerDir, 'src', 'actions'),
    generation: output,
    hasAuth: includeAuthFile,
    hasEnv: includeEnvFile,
    trustedOrigins: includeAuthFile ? getTrustedOriginsFromAuth(authFilePath) : [],
  });

  transpileTsToJs({
    tsConfigFilePath: path.join(tempServerDir, 'tsconfig.json'),
    cjs: false,
    quiet: true,
    tempServerDirPath: tempServerDir,
    serverDistDirPath: serverDir,
  });

  const serverSrcDir = path.join(serverDir, 'src');
  const nodeModulesDir = path.join(serverDir, 'node_modules');

  const importRegexp = /(?:\bfrom\s+|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;
  const specifiers = new Set<string>();

  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        collect(entryPath);
      } else if (/\.[mc]?[jt]sx?$/.test(entry.name)) {
        for (const match of readFileSync(entryPath, 'utf8').matchAll(importRegexp)) {
          const specifier = match[1] ?? '';
          const [first] = specifier.split('/');

          if (
            !specifier.startsWith('.') &&
            !specifier.startsWith('node:') &&
            !specifier.startsWith('cloudflare:') &&
            first &&
            !NODE_BUILTINS.has(first)
          ) {
            specifiers.add(specifier);
          }
        }
      }
    }
  };

  collect(serverSrcDir);

  for (const specifier of specifiers) {
    const segments = specifier.split('/');
    const packageName = (specifier.startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0]) ?? '';
    const subpath = specifier.slice(packageName.length + 1);
    const packageDir = path.join(nodeModulesDir, packageName);

    mkdirSync(packageDir, { recursive: true });

    if (!existsSync(path.join(packageDir, 'package.json'))) {
      writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: packageName, version: '0.0.0', main: 'index.js' }));
    }

    const filePath = path.join(packageDir, subpath ? `${subpath}.js` : 'index.js');

    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, 'module.exports = {};');
  }

  return serverDir;
};
