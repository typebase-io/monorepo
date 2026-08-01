import fs from 'node:fs/promises';
import path from 'node:path';

import { DEPS, PACKAGE_MANAGER_FIELD_NAMES, PACKAGE_MANAGER_VERSIONS, type ServerAdapter } from '#helpers/constants.ts';
import { getPackageDeps } from '#helpers/shared/get-package-deps.ts';
import { getPackageManager } from '#helpers/shared/get-package-manager.ts';
import { getUserPackageJson } from '#helpers/shared/get-user-package-json.ts';

export const generatePackageJson = async ({
  adapter,
  typebaseDirPath,
  outputDirPath,
  generation,
  outDir,
  hasAuth,
  hasEnv,
}: {
  adapter: ServerAdapter;
  typebaseDirPath: string;
  outputDirPath: string;
  generation: 'cjs' | 'esm' | 'ts';
  outDir: string;
  hasAuth: boolean;
  hasEnv: boolean;
}) => {
  const defaultSkipDirs = new Set(['node_modules', 'dist', 'build', outDir]);
  const userDependencies = await getPackageDeps({ sourceDirPath: typebaseDirPath, skipDirs: (name) => defaultSkipDirs.has(name) });
  const userPackageJson = await getUserPackageJson(typebaseDirPath);
  const typebaseVersion =
    userPackageJson.dependencies?.['typebase-io'] ??
    userPackageJson.devDependencies?.['typebase-io'] ??
    userPackageJson.dependencies?.['@typebase-io/typebase'] ??
    userPackageJson.devDependencies?.['@typebase-io/typebase'] ??
    '*';

  const dependencies: Record<string, string> = {
    'typebase-io': typebaseVersion,
    [DEPS['@orpc/server'].name]: DEPS['@orpc/server'].version,
    [DEPS['drizzle-kit'].name]: DEPS['drizzle-kit'].version,
    [DEPS['drizzle-orm'].name]: DEPS['drizzle-orm'].version,
  };

  const devDependencies: Record<string, string> = {};

  if (adapter === 'cloudflare') {
    dependencies[DEPS['@neondatabase/serverless'].name] = DEPS['@neondatabase/serverless'].version;
  } else {
    dependencies[DEPS.pg.name] = DEPS.pg.version;
  }

  if (adapter === 'fastify') {
    dependencies[DEPS.fastify.name] = DEPS.fastify.version;

    if (hasAuth) {
      dependencies[DEPS['@fastify/cors'].name] = DEPS['@fastify/cors'].version;
    }
  }

  if (adapter === 'hono') {
    dependencies[DEPS.hono.name] = DEPS.hono.version;
  }

  if (hasAuth) {
    dependencies[DEPS['better-auth'].name] = DEPS['better-auth'].version;
    dependencies[DEPS['@better-auth/drizzle-adapter'].name] = DEPS['@better-auth/drizzle-adapter'].version;
  }

  if (hasEnv) {
    dependencies[DEPS['@t3-oss/env-core'].name] = DEPS['@t3-oss/env-core'].version;

    if (adapter !== 'cloudflare') {
      dependencies[DEPS.dotenv.name] = DEPS.dotenv.version;
    }
  }

  if (generation === 'ts') {
    devDependencies[DEPS['@types/node'].name] = DEPS['@types/node'].version;
    devDependencies[DEPS['@types/pg'].name] = DEPS['@types/pg'].version;
    devDependencies[DEPS.typescript.name] = DEPS.typescript.version;
  }

  const packageManager = await getPackageManager();

  const packageJson: Record<string, unknown> = {
    name: '@typebase-io/server',
    type: generation === 'cjs' ? 'commonjs' : 'module',
    version: '1.0.0',
    main: generation === 'ts' ? 'src/index.ts' : 'src/index.js',
    scripts: {
      start: generation === 'ts' ? 'node src/index.ts' : 'node src/index.js',
    },
    dependencies: Object.fromEntries(Object.entries({ ...userDependencies, ...dependencies }).sort(([a], [b]) => a.localeCompare(b))),
    devDependencies: Object.fromEntries(Object.entries(devDependencies).sort(([a], [b]) => a.localeCompare(b))),
  };

  if (packageManager !== 'unknown') {
    packageJson.packageManager = `${PACKAGE_MANAGER_FIELD_NAMES[packageManager]}@${PACKAGE_MANAGER_VERSIONS[packageManager]}`;
  }

  if (packageManager === 'pnpm') {
    packageJson.pnpm = { onlyBuiltDependencies: ['esbuild'] };
  }

  await fs.writeFile(path.join(outputDirPath, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
};
