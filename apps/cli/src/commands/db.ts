import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import { confirm, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { match } from 'ts-pattern';

import { type ServerAdapter, serverProviders } from '#helpers/constants.ts';
import { neon } from '#helpers/db/neon/index.ts';
import { pullSchema } from '#helpers/db/pull-schema.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';
import { toTypebaseRelations } from '#helpers/db/to-typebase-relations.ts';
import { toTypebaseSchema } from '#helpers/db/to-typebase-schema.ts';
import { generateDBFiles } from '#helpers/generate-server/generate-db-files.ts';
import { transpileTsToJs } from '#helpers/generate-server/transpile-ts-to-js.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { hasAuth } from '#helpers/shared/has-auth.ts';
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

const createPullCommand = () =>
  new Command('pull')
    .summary('Generate your schema and relations from an existing database')
    .description(
      'Read the tables of an existing PostgreSQL database and write them to `<typebase>/db/schema.ts` and `<typebase>/db/relations.ts`. Useful when moving an existing app (a Supabase project, a database you already run) to Typebase.'
    )
    .option('--url <url>', 'PostgreSQL connection string of the database to read (prompted for when omitted)')
    .option('-f, --force', 'Overwrite `db/schema.ts` and `db/relations.ts` without asking')
    .allowExcessArguments(false)
    .action(async ({ url, force }) => {
      const { projectPath } = await getTypebaseConfig();
      const typebaseDirPath = path.resolve(projectPath);

      const tsConfigFilePath = path.join(typebaseDirPath, 'tsconfig.json');
      const authFilePath = path.join(typebaseDirPath, 'auth.ts');
      const envFilePath = path.join(typebaseDirPath, 'env.ts');
      const dbDirPath = path.join(typebaseDirPath, 'db');
      const schemaFilePath = path.join(dbDirPath, 'schema.ts');
      const relationsFilePath = path.join(dbDirPath, 'relations.ts');
      const actionsDirPath = path.join(typebaseDirPath, 'actions');

      const generatedDirPath = path.join(typebaseDirPath, '_generated');
      const dbTypesOutputPath = path.join(generatedDirPath, 'db.d.ts');

      if (!existsSync(tsConfigFilePath)) {
        throw new Error(`No Typebase project found at \`${path.relative(process.cwd(), typebaseDirPath) || '.'}\`. Run \`init\` first.`);
      }

      const existingFilePaths = [schemaFilePath, relationsFilePath].filter((filePath) => existsSync(filePath));

      if (existingFilePaths.length > 0 && !force) {
        const names = existingFilePaths.map((filePath) => `\`${path.relative(process.cwd(), filePath)}\``).join(' and ');

        console.log(chalk.yellow(`\n${names} already exist and will be replaced by whatever the database contains.`));

        if (hasAuth(authFilePath)) {
          console.log(chalk.yellow('Your auth tables go with them, so run `auth generate` afterwards unless the database already holds them.'));
        }

        console.log('\n');

        const accepted = await confirm({ message: 'Overwrite them?', default: false });

        if (!accepted) {
          ora().info('Nothing was written.');

          return;
        }
      }

      const connectionUri =
        url ??
        (await input({
          message: 'PostgreSQL connection string of the database to read:',
          validate: (value) => (value.trim().length > 0 ? true : 'A connection string is required.'),
        }));

      const spinner = ora('Reading database schema...').start();

      let pulled;

      try {
        pulled = await pullSchema({ connectionUri: connectionUri.trim() });
      } catch (error) {
        spinner.fail('Could not read the database.');

        throw error;
      }

      const { source: schema, tableNames } = toTypebaseSchema(pulled.schema);

      if (tableNames.length === 0) {
        spinner.fail('That database has no tables to read.');

        return;
      }

      const relations = toTypebaseRelations({ source: pulled.relations, tableNames });

      await fs.mkdir(dbDirPath, { recursive: true });
      await fs.writeFile(schemaFilePath, schema);
      await fs.writeFile(relationsFilePath, relations);

      spinner.succeed(`${tableNames.length} ${tableNames.length === 1 ? 'table' : 'tables'} written to schema.ts and relations.ts.`);

      const typesSpinner = ora('Generating types...').start();

      await Promise.all([
        generateDBTypes({ schemaFilePath, authFilePath, outFilePath: dbTypesOutputPath }),
        generateServerTypes({ tsConfigFilePath, schemaFilePath, authFilePath, envFilePath, actionsDirPath, generatedDirPath }),
      ]);

      typesSpinner.succeed('Types generated!');

      if (schema.includes('p.pgSchema(')) {
        console.log(
          chalk.yellow(
            '\nSome of your tables reference tables in another schema, so those came across too (look for `p.pgSchema`). Review them: a Supabase `auth.users` reference belongs on the `users` table `auth generate` creates instead.'
          )
        );
      }

      const writtenFileNames = [schemaFilePath, relationsFilePath].map((filePath) => path.relative(process.cwd(), filePath)).join(' and ');

      console.log(
        chalk.cyan(`\n${writtenFileNames} now describe the database you just read. It was only read from: nothing there was created or changed.`)
      );
      console.log('\nTo get the same tables into the database your Typebase server uses, review those two files and then run:');
      console.log(`${chalk.bold('npx typebase-io-cli db dev push')} ${chalk.dim('or npx typebase-io-cli db prod push for production.')}`);
    });

export const db = new Command('db')
  .summary('Manage your database')
  .addCommand(createTargetCommand('dev'))
  .addCommand(createTargetCommand('prod'))
  .addCommand(createLocalCommand())
  .addCommand(createPullCommand());
