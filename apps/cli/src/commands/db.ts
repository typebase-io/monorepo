import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import { confirm, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { match } from 'ts-pattern';

import { serverProviders } from '#helpers/constants.ts';
import { applyMigrations } from '#helpers/db/apply-migrations.ts';
import { assertNotMigrationsMode } from '#helpers/db/assert-not-migrations-mode.ts';
import { buildSchema } from '#helpers/db/build-schema.ts';
import { detectDrift } from '#helpers/db/detect-drift.ts';
import { generateCustomMigration } from '#helpers/db/generate-custom-migration.ts';
import { generateMigration } from '#helpers/db/generate-migration.ts';
import { markMigrationApplied } from '#helpers/db/mark-migration-applied.ts';
import { findNeonTarget } from '#helpers/db/neon/find-neon-target.ts';
import { neon } from '#helpers/db/neon/index.ts';
import { pullSchema } from '#helpers/db/pull-schema.ts';
import { pushSchema } from '#helpers/db/push-schema.ts';
import { readMigrations } from '#helpers/db/read-migrations.ts';
import { toTypebaseRelations } from '#helpers/db/to-typebase-relations.ts';
import { toTypebaseSchema } from '#helpers/db/to-typebase-schema.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { hasAuth } from '#helpers/shared/has-auth.ts';
import { hasDB } from '#helpers/shared/has-db.ts';
import { hasMigrations } from '#helpers/shared/has-migrations.ts';
import { readEnvVariable } from '#helpers/shared/read-env-variable.ts';
import { writeTypebaseConfig } from '#helpers/shared/write-typebase-config.ts';

const createTargetCommand = (target: 'dev' | 'prod') =>
  new Command(target)
    .summary(`Manage ${target} database`)
    .addCommand(
      new Command('migrate')
        .summary(`Apply pending migrations to your ${target} database`)
        .allowExcessArguments(false)
        .action(async () => {
          const { projectPath, serverProvider } = await getTypebaseConfig();
          const typebaseDirPath = path.resolve(projectPath);
          const dbDirPath = path.join(typebaseDirPath, 'db');
          const migrationsDirPath = path.join(dbDirPath, 'migrations');
          const schemaFilePath = path.join(dbDirPath, 'schema.ts');

          if (!hasMigrations(migrationsDirPath)) {
            throw new Error(
              'This project does not use migrations. Run `db migrations init` to start recording schema changes, or push your schema directly.'
            );
          }

          if (hasDB(schemaFilePath)) {
            const { tables } = await detectDrift({ dbDirPath, migrationsDirPath, serverProvider });

            if (tables.length !== 0) {
              ora().warn(`Your schema files have changes that no migration records, affecting ${tables.join(', ')}.`);

              console.log(
                chalk.yellow('Run `db migrations generate` to record them. Applying now brings this target up to the last recorded migration only.\n')
              );
            }
          }

          const { connectionUri } = await neon({ target });
          const { applied } = await applyMigrations({ migrationsDirPath, connectionUri });

          if (applied.length === 0) {
            ora().succeed('Database is up to date. No migrations to apply.');

            return;
          }

          ora().succeed(`${applied.length} ${applied.length === 1 ? 'migration' : 'migrations'} applied.`);

          for (const name of applied) {
            console.log(chalk.dim(`  ${name}`));
          }
        })
    )
    .addCommand(
      new Command('push')
        .summary('Push schema changes to your database')
        .option('--skip-confirmation', 'Apply destructive changes without asking. They are still reported.')
        .allowExcessArguments(false)
        .action(async ({ skipConfirmation = false }) => {
          const { projectPath, serverProvider } = await getTypebaseConfig();

          const typebaseDirPath = path.resolve(projectPath);
          const schemaFilePath = path.join(typebaseDirPath, 'db', 'schema.ts');
          const dbDirPath = path.join(typebaseDirPath, 'db');

          if (!hasDB(schemaFilePath)) {
            throw new Error('No database schema found. Create a schema file at db/schema.ts.');
          }

          assertNotMigrationsMode({ migrationsDirPath: path.join(dbDirPath, 'migrations'), target });

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

          const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider: provider });

          try {
            const { connectionUri } = await neon({ target });

            await pushSchema({ serverDistDirPath, connectionUri, skipConfirmation });
          } finally {
            await cleanup();
          }
        })
    );

const createLocalCommand = () =>
  new Command('local')
    .summary('Manage local database')
    .addCommand(
      new Command('migrate')
        .summary('Apply pending migrations to your local database')
        .option('--url <url>', 'Database URL (defaults to DATABASE_URL env var)')
        .allowExcessArguments(false)
        .action(async (options) => {
          const { projectPath, serverProvider } = await getTypebaseConfig();
          const typebaseDirPath = path.resolve(projectPath);
          const dbDirPath = path.join(typebaseDirPath, 'db');
          const migrationsDirPath = path.join(dbDirPath, 'migrations');
          const schemaFilePath = path.join(dbDirPath, 'schema.ts');

          if (!hasMigrations(migrationsDirPath)) {
            throw new Error(
              'This project does not use migrations. Run `db migrations init` to start recording schema changes, or push your schema directly.'
            );
          }

          const connectionUri = options.url ?? readEnvVariable('DATABASE_URL');

          if (!connectionUri) {
            throw new Error('No database URL provided. Pass --url or set DATABASE_URL.');
          }

          if (hasDB(schemaFilePath)) {
            const { tables } = await detectDrift({ dbDirPath, migrationsDirPath, serverProvider });

            if (tables.length !== 0) {
              ora().warn(`Your schema files have changes that no migration records, affecting ${tables.join(', ')}.`);

              console.log(
                chalk.yellow('Run `db migrations generate` to record them. Applying now brings this target up to the last recorded migration only.\n')
              );
            }
          }

          const { applied } = await applyMigrations({ migrationsDirPath, connectionUri });

          if (applied.length === 0) {
            ora().succeed('Database is up to date. No migrations to apply.');

            return;
          }

          ora().succeed(`${applied.length} ${applied.length === 1 ? 'migration' : 'migrations'} applied.`);

          for (const name of applied) {
            console.log(chalk.dim(`  ${name}`));
          }
        })
    )
    .addCommand(
      new Command('push')
        .summary('Push schema changes to your local database')
        .option('--url <url>', 'Database URL (defaults to DATABASE_URL env var)')
        .option('--skip-confirmation', 'Apply destructive changes without asking. They are still reported.')
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

          assertNotMigrationsMode({ migrationsDirPath: path.join(dbDirPath, 'migrations'), target: 'local' });

          const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider });

          try {
            await pushSchema({ serverDistDirPath, connectionUri, skipConfirmation: options.skipConfirmation ?? false });
          } finally {
            await cleanup();
          }
        })
    );

const createMigrationsCommand = () =>
  new Command('migrations')
    .summary('Manage your migration history')
    .addCommand(
      new Command('init')
        .summary('Start recording migrations in a project that has been pushing its schema')
        .description(
          'Record the schema you already have as a baseline migration, and mark the databases that already have those tables as having applied it. A target with no database yet is left alone and replays the baseline for real the first time you migrate it.'
        )
        .allowExcessArguments(false)
        .action(async () => {
          const { projectPath, serverProvider } = await getTypebaseConfig();

          const typebaseDirPath = path.resolve(projectPath);
          const dbDirPath = path.join(typebaseDirPath, 'db');
          const schemaFilePath = path.join(dbDirPath, 'schema.ts');
          const migrationsDirPath = path.join(dbDirPath, 'migrations');

          if (!hasDB(schemaFilePath)) {
            throw new Error('No database schema found. Create a schema file at db/schema.ts.');
          }

          const existingBaseline = (await readMigrations(migrationsDirPath)).find(({ name }) => name.endsWith('_baseline'));

          if (hasMigrations(migrationsDirPath) && !existingBaseline) {
            throw new Error(
              'This project already uses migrations and has no baseline to adopt. Run `db migrations generate` to record schema changes instead.'
            );
          }

          const targets: { target: 'dev' | 'prod'; connectionUri: string }[] = [];

          for (const target of ['dev', 'prod'] as const) {
            const found = await findNeonTarget({ target });

            if (found) {
              targets.push({ target, connectionUri: found.connectionUri });
            } else {
              ora().info(`No ${target} database yet. It will replay the baseline the first time you run \`db ${target} migrate\`.`);
            }
          }

          if (!existingBaseline) {
            const marking = targets.length > 0 ? ` and mark ${targets.map(({ target }) => target).join(' and ')} as having applied it` : '';

            const accepted = await confirm({ message: `Record a baseline for your current schema${marking}?`, default: true });

            if (!accepted) {
              ora().info('Nothing was recorded.');

              return;
            }
          }

          if (!existingBaseline && targets.length > 0) {
            const { serverDistDirPath, cleanup } = await buildSchema({ dbDirPath, serverProvider });

            try {
              for (const { target, connectionUri } of targets) {
                const { sqlStatements } = await pushSchema({ serverDistDirPath, connectionUri, dryRun: true, skipConfirmation: true });

                if (sqlStatements.length === 0) {
                  continue;
                }

                ora().warn(`Your ${target} database does not match your schema files.`);

                const accepted = await confirm({ message: `Push your schema to ${target} before recording the baseline?`, default: false });

                if (!accepted) {
                  throw new Error(
                    `Cannot record a baseline while ${target} does not match your schema files. Bring it in line with \`db ${target} push\`, or change your schema files to match, and run this again.`
                  );
                }

                await pushSchema({ serverDistDirPath, connectionUri, skipConfirmation: false });
              }
            } finally {
              await cleanup();
            }
          }

          const baseline =
            existingBaseline ?? (await generateMigration({ dbDirPath, migrationsDirPath, serverProvider, name: 'baseline', allowEmpty: true }));

          ora().succeed(
            existingBaseline
              ? `Baseline already recorded at ${path.relative(process.cwd(), baseline.dirPath)}.`
              : `Baseline recorded at ${path.relative(process.cwd(), baseline.dirPath)}.`
          );

          for (const { target, connectionUri } of targets) {
            const { marked } = await markMigrationApplied({ migrationsDirPath, connectionUri, name: baseline.name });

            ora().succeed(marked ? `${target} marked as having applied ${baseline.name}.` : `${target} was already marked.`);
          }

          console.log(chalk.cyan('\nCommit the baseline. From now on, record schema changes with:'));
          console.log(chalk.bold('npx typebase-io-cli db migrations generate'));
        })
    )
    .addCommand(
      new Command('generate')
        .summary('Generate a migration based on the changes on your schema')
        .option('--name <name>', 'Name for the migration, so the history reads well in a pull request')
        .option('--custom', 'Create an empty migration and write the SQL yourself, for changes the schema diff cannot express')
        .option('--ignore-conflicts', 'Generate even though the migration history has forked')
        .allowExcessArguments(false)
        .action(async ({ name, custom, ignoreConflicts }) => {
          const { projectPath, serverProvider } = await getTypebaseConfig();

          const typebaseDirPath = path.resolve(projectPath);
          const schemaFilePath = path.join(typebaseDirPath, 'db', 'schema.ts');
          const dbDirPath = path.join(typebaseDirPath, 'db');
          const migrationsDirPath = path.join(dbDirPath, 'migrations');

          if (!hasDB(schemaFilePath)) {
            throw new Error('No database schema found. Create a schema file at db/schema.ts.');
          }

          if (!hasMigrations(migrationsDirPath)) {
            throw new Error(
              `This project does not use migrations. Run \`db migrations init\` to start recording schema changes, or keep using \`db <target> push\`.`
            );
          }

          if (custom) {
            const { dirPath } = await generateCustomMigration({ migrationsDirPath, name, ignoreConflicts });

            ora().succeed(`Empty migration created at ${path.relative(process.cwd(), dirPath)}.`);

            console.log(chalk.cyan('\nWrite your SQL in its migration.sql, commit it, then apply it with:'));
            console.log(`${chalk.bold('npx typebase-io-cli db dev migrate')} ${chalk.dim('or npx typebase-io-cli db prod migrate for production.')}`);

            return;
          }

          const migration = await generateMigration({ dbDirPath, migrationsDirPath, serverProvider, name, ignoreConflicts });

          if (!migration) {
            ora().succeed('Schema is up to date. No migration written.');

            return;
          }

          ora().succeed(`Migration written to ${path.relative(process.cwd(), migration.dirPath)}.`);

          console.log(chalk.cyan('\nReview the SQL, commit it, then apply it with:'));
          console.log(`${chalk.bold('npx typebase-io-cli db dev migrate')} ${chalk.dim('or npx typebase-io-cli db prod migrate for production.')}`);
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
      const { projectPath, serverProvider } = await getTypebaseConfig();
      const typebaseDirPath = path.resolve(projectPath);

      const tsConfigFilePath = path.join(typebaseDirPath, 'tsconfig.json');
      const authFilePath = path.join(typebaseDirPath, 'auth.ts');
      const envFilePath = path.join(typebaseDirPath, 'env.ts');
      const publisherFilePath = path.join(typebaseDirPath, 'publisher.ts');
      const dbDirPath = path.join(typebaseDirPath, 'db');
      const migrationsDirPath = path.join(dbDirPath, 'migrations');
      const schemaFilePath = path.join(dbDirPath, 'schema.ts');
      const relationsFilePath = path.join(dbDirPath, 'relations.ts');
      const actionsDirPath = path.join(typebaseDirPath, 'actions');

      const generatedDirPath = path.join(typebaseDirPath, '_generated');
      const dbTypesOutputPath = path.join(generatedDirPath, 'db.d.ts');

      if (!existsSync(tsConfigFilePath)) {
        throw new Error(`No Typebase project found at \`${path.relative(process.cwd(), typebaseDirPath) || '.'}\`. Run \`init\` first.`);
      }

      if (hasMigrations(migrationsDirPath) && !force) {
        throw new Error(
          'This project records its schema as migrations, and pulling would replace the schema files that history describes. Re-run with `--force` to pull anyway and rebaseline the history from what was pulled.'
        );
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
        generateServerTypes({ tsConfigFilePath, schemaFilePath, authFilePath, envFilePath, publisherFilePath, actionsDirPath, generatedDirPath }),
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

      const rebaselining = hasMigrations(migrationsDirPath);

      if (rebaselining) {
        await fs.rm(migrationsDirPath, { recursive: true, force: true });

        await generateMigration({ dbDirPath, migrationsDirPath, serverProvider, name: 'baseline', allowEmpty: true });

        ora().succeed('Migration history rebaselined from what was pulled.');

        console.log(
          chalk.yellow(
            '\nYour databases still record the migrations this replaced, so every target has to be marked against the new baseline before it is migrated again. Nothing on them was changed by this pull.'
          )
        );
        console.log(`Run ${chalk.bold('npx typebase-io-cli db migrations init')} once each target is reachable.`);

        return;
      }

      const adopt = await confirm({ message: 'Record this schema as a migration and start using migrations?', default: false });

      if (adopt) {
        await generateMigration({ dbDirPath, migrationsDirPath, serverProvider, name: 'baseline', allowEmpty: true });

        ora().succeed('Baseline recorded. This project now uses migrations.');

        console.log('\nTo get the same tables into the database your Typebase server uses, review those two files and then run:');
        console.log(`${chalk.bold('npx typebase-io-cli db migrations init')} ${chalk.dim('to mark the databases that already have them.')}`);

        return;
      }

      console.log('\nTo get the same tables into the database your Typebase server uses, review those two files and then run:');
      console.log(`${chalk.bold('npx typebase-io-cli db dev push')} ${chalk.dim('or npx typebase-io-cli db prod push for production.')}`);
    });

export const db = new Command('db')
  .summary('Manage your database')
  .addCommand(createTargetCommand('dev'))
  .addCommand(createTargetCommand('prod'))
  .addCommand(createLocalCommand())
  .addCommand(createMigrationsCommand())
  .addCommand(createPullCommand());
