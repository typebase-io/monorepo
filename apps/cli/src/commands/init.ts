import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Command, Option } from '@commander-js/extra-typings';
import chalk, { chalkStderr } from 'chalk';
import ora from 'ora';

import { generateAuthSchema } from '#helpers/auth/generate-auth-schema.ts';
import { generateExampleActions } from '#helpers/init/generate-example-actions.ts';
import { generateExampleAuth } from '#helpers/init/generate-example-auth.ts';
import { generateExampleRelations } from '#helpers/init/generate-example-relations.ts';
import { generateExampleSchema } from '#helpers/init/generate-example-schema.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { baseRelationsTemplate } from '#helpers/templates/base-relations.ts';
import { baseSchemaTemplate } from '#helpers/templates/base-schema.ts';

export const init = new Command('init')
  .summary('Create a basic Typebase project structure')
  .description('Create a `typebase/` directory with a default `tsconfig.json` and example files.')
  .allowExcessArguments(false)
  .option('-f, --force', 'Regenerates the scaffolded example files if they already exist')
  .addOption(new Option('--with-auth', 'Creates the example with auth').default(false).conflicts('skipExample'))
  .option('--skip-example', 'Skips the example schema and actions')
  .action(async ({ force, withAuth, skipExample }) => {
    const config = await getTypebaseConfig();
    const typebaseDirPath = path.resolve(config.projectPath);

    const dbDirPath = path.join(typebaseDirPath, 'db');
    const tsConfigFilePath = path.join(typebaseDirPath, 'tsconfig.json');
    const exampleAuthPath = path.join(typebaseDirPath, 'auth.ts');
    const exampleSchemaPath = path.join(dbDirPath, 'schema.ts');
    const exampleRelationsPath = path.join(dbDirPath, 'relations.ts');

    const actionsDirPath = path.join(typebaseDirPath, 'actions');
    const exampleAuthFilePath = path.join(typebaseDirPath, 'auth.ts');
    const generatedDirPath = path.join(typebaseDirPath, '_generated');
    const dbTypesOutputPath = path.join(generatedDirPath, 'db.d.ts');

    await fs.mkdir(typebaseDirPath, { recursive: true });
    await fs.mkdir(dbDirPath, { recursive: true });

    const tsConfigExists = existsSync(tsConfigFilePath);

    if (tsConfigExists && !force) {
      console.error(chalkStderr.red(`\`${path.relative(process.cwd(), tsConfigFilePath)}\` already exists. Use \`--force\` to recreate it.`));

      process.exitCode = 1;

      return;
    }

    const spinner = ora('Generating files...').start();

    await Promise.all([
      generateTsConfig({ path: tsConfigFilePath, addWarning: true }),
      withAuth ? generateExampleAuth(exampleAuthPath) : Promise.resolve(),
      skipExample ? fs.writeFile(exampleSchemaPath, `${baseSchemaTemplate}\n`) : generateExampleSchema({ path: exampleSchemaPath, withAuth }),
      skipExample
        ? fs.writeFile(exampleRelationsPath, `${baseRelationsTemplate}\n`)
        : generateExampleRelations({ path: exampleRelationsPath, withAuth }),
      skipExample ? Promise.resolve() : generateExampleActions({ typebaseDirPath, withAuth }),
    ]);

    if (withAuth) {
      await generateAuthSchema({
        schemaFilePath: exampleSchemaPath,
        relationsFilePath: exampleRelationsPath,
        authFilePath: exampleAuthPath,
      });
    }

    spinner.text = 'Generating types...';

    await Promise.all([
      generateDBTypes({
        schemaFilePath: exampleSchemaPath,
        authFilePath: exampleAuthFilePath,
        outFilePath: dbTypesOutputPath,
      }),

      generateServerTypes({
        tsConfigFilePath,
        schemaFilePath: exampleSchemaPath,
        authFilePath: exampleAuthFilePath,
        actionsDirPath,
        generatedDirPath,
      }),
    ]);

    spinner.succeed(`Typebase project initialized at \`${path.relative(process.cwd(), typebaseDirPath) || '.'}\`.`);

    console.log(chalk.cyan('\nWorking with an AI agent? Install the Typebase skill so it picks up the conventions automatically:'));
    console.log(chalk.bold('npx skills add typebase-io/monorepo'));
    console.log(chalk.underline('https://typebase.io/docs/skill\n'));
  });
