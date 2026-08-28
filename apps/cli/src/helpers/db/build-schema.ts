import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import ora from 'ora';
import { match } from 'ts-pattern';

import { type ServerAdapter, type ServerProvider } from '#helpers/constants.ts';
import { generateDBFiles } from '#helpers/generate-server/generate-db-files.ts';
import { transpileTsToJs } from '#helpers/generate-server/transpile-ts-to-js.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';

export const buildSchema = async ({
  dbDirPath,
  serverProvider,
  quiet,
}: {
  dbDirPath: string;
  serverProvider: ServerProvider | undefined;
  quiet?: boolean;
}) => {
  const tempDirPath = await fs.mkdtemp(path.join(tmpdir(), 'typebase-db-schema-'));
  const serverDistDirPath = path.join(tempDirPath, 'build');
  const tsConfigOutputPath = path.join(tempDirPath, 'tsconfig.json');
  const dbOutputDirPath = path.join(tempDirPath, 'src', 'db');

  const cleanup = () => fs.rm(tempDirPath, { recursive: true, force: true });

  const adapter = match(serverProvider)
    .returnType<ServerAdapter>()
    .with('vercel', () => 'hono')
    .with('deno', () => 'deno')
    .with('cloudflare', () => 'cloudflare')
    .with(undefined, () => 'hono')
    .exhaustive();

  try {
    const spinner = quiet ? undefined : ora('Building schema...').start();

    await generateTsConfig({ path: tsConfigOutputPath, addWarning: false });
    await generateDBFiles({ dbDirPath, dbOutputDirPath, useTs: false, adapter });

    transpileTsToJs({
      tsConfigFilePath: tsConfigOutputPath,
      cjs: false,
      quiet: true,
      tempServerDirPath: tempDirPath,
      serverDistDirPath,
    });

    spinner?.succeed('Schema built.');
  } catch (error) {
    await cleanup();

    throw error;
  }

  return { serverDistDirPath, cleanup };
};
