import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import { select } from '@inquirer/prompts';
import ora from 'ora';
import { match } from 'ts-pattern';

import { type ServerAdapter, serverProviders } from '#helpers/constants.ts';
import { neon } from '#helpers/db/neon/index.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';
import { generateDBFiles } from '#helpers/generate-server/generate-db-files.ts';
import { transpileTsToJs } from '#helpers/generate-server/transpile-ts-to-js.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { hasDB } from '#helpers/shared/has-db.ts';
import { readEnvVariable } from '#helpers/shared/read-env-variable.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

const createTargetCommand = (target: 'dev' | 'prod') =>
  new Command(target).summary(`Manage ${target} database`).addCommand(
    new Command('push')
      .summary('Push schema changes to your database')
      .allowExcessArguments(false)
      .action(async () => {
        const { projectPath, serverProvider } = await getTypebaseConfig();

        const typebaseDirPath = path.resolve(projectPath);
        const schemaFilePath = path.join(typebaseDirPath, 'db', 'schema.ts');
        const dbDirPath = path.join(typebaseDirPath, 'db');

        if (!hasDB(schemaFilePath)) {
          throw new Error('No database schema found. Create a schema file at db/schema.ts.');
        }

        const provider = await match(serverProvider)
          .with(undefined, () => {
            return select({
              message: 'Select the provider your server deploys to (used to build the schema for the right runtime):',
              choices: serverProviders.map((provider) => ({ name: provider, value: provider })),
            });
          })
          .otherwise((provider) => provider);

        if (!serverProvider) {
          await writeTypebaseConfig({ serverProvider: provider });
          ora().succeed('Provider saved to typebase.json.');
        }

        const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'typebase-db-push-'));
        const distDir = path.join(tempDir, 'build');
        const tsConfigOutputPath = path.join(tempDir, 'tsconfig.json');
        const dbOutputDirPath = path.join(tempDir, 'src', 'db');

        const adapter = match(provider)
          .returnType<ServerAdapter>()
          .with('vercel', () => 'hono')
          .with('deno', () => 'deno')
          .with('cloudflare', () => 'cloudflare')
          .exhaustive();

        try {
          const spinner = ora('Building schema...').start();

          await generateTsConfig({ path: tsConfigOutputPath, addWarning: false });
          await generateDBFiles({ dbDirPath, dbOutputDirPath, useTs: false, adapter });

          transpileTsToJs({
            tsConfigFilePath: tsConfigOutputPath,
            cjs: false,
            quiet: true,
            tempServerDirPath: tempDir,
            serverDistDirPath: distDir,
          });

          spinner.succeed('Schema built.');

          const { connectionUri } = await neon({ target });

          await pushSchema({ serverDistDirPath: distDir, connectionUri });
        } finally {
          await fs.rm(tempDir, { recursive: true, force: true });
        }
      })
  );

const createLocalCommand = () =>
  new Command('local').summary('Manage local database').addCommand(
    new Command('push')
      .summary('Push schema changes to your local database')
      .option('--url <url>', 'Database URL (defaults to DATABASE_URL env var)')
      .allowExcessArguments(false)
      .action(async (options) => {
        const connectionUri = options.url ?? readEnvVariable('DATABASE_URL');

        if (!connectionUri) {
          throw new Error('No database URL provided. Pass --url or set DATABASE_URL.');
        }

        const { projectPath, serverProvider } = await getTypebaseConfig();

        const typebaseDirPath = path.resolve(projectPath);
        const schemaFilePath = path.join(typebaseDirPath, 'db', 'schema.ts');
        const dbDirPath = path.join(typebaseDirPath, 'db');

        if (!hasDB(schemaFilePath)) {
          throw new Error('No database schema found. Create a schema file at db/schema.ts.');
        }

        const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'typebase-db-push-'));
        const distDir = path.join(tempDir, 'build');
        const tsConfigOutputPath = path.join(tempDir, 'tsconfig.json');
        const dbOutputDirPath = path.join(tempDir, 'src', 'db');

        const adapter = match(serverProvider)
          .returnType<ServerAdapter>()
          .with('vercel', () => 'hono')
          .with('deno', () => 'deno')
          .with('cloudflare', () => 'cloudflare')
          .with(undefined, () => 'hono')
          .exhaustive();

        try {
          const spinner = ora('Building schema...').start();

          await generateTsConfig({ path: tsConfigOutputPath, addWarning: false });
          await generateDBFiles({ dbDirPath, dbOutputDirPath, useTs: false, adapter });

          transpileTsToJs({
            tsConfigFilePath: tsConfigOutputPath,
            cjs: false,
            quiet: true,
            tempServerDirPath: tempDir,
            serverDistDirPath: distDir,
          });

          spinner.succeed('Schema built.');

          await pushSchema({ serverDistDirPath: distDir, connectionUri });
        } finally {
          await fs.rm(tempDir, { recursive: true, force: true });
        }
      })
  );

export const db = new Command('db')
  .summary('Manage your database')
  .addCommand(createTargetCommand('dev'))
  .addCommand(createTargetCommand('prod'))
  .addCommand(createLocalCommand());
