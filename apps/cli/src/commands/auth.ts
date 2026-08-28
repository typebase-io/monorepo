import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import ora from 'ora';

import { generateAuthSchema } from '#helpers/auth/generate-auth-schema.ts';
import { getAndSaveAuthSecret } from '#helpers/auth/get-and-save-auth-secret.ts';
import { generateMigration } from '#helpers/db/generate-migration.ts';
import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { hasAuth } from '#helpers/shared/has-auth.ts';
import { hasMigrations } from '#helpers/shared/has-migrations.ts';
import { resolveProjectShapeOrThrow } from '#helpers/shared/resolve-project-shape-or-throw.ts';

export const auth = new Command('auth').summary('Manage authentication').addCommand(
  new Command('generate')
    .summary('Add auth tables to your database schema')
    .description(
      'Append better-auth tables (users, sessions, accounts, verifications) to `<typebase>/db/schema.ts` and register them in `<typebase>/db/relations.ts`.'
    )
    .allowExcessArguments(false)
    .action(async () => {
      const { projectPath, serverProvider } = await getTypebaseConfig();
      const typebaseDirPath = path.resolve(projectPath);

      const tsConfigFilePath = path.join(typebaseDirPath, 'tsconfig.json');
      const authFilePath = path.join(typebaseDirPath, 'auth.ts');
      const envFilePath = path.join(typebaseDirPath, 'env.ts');
      const publisherFilePath = path.join(typebaseDirPath, 'publisher.ts');
      const dbDirPath = path.join(typebaseDirPath, 'db');
      const migrationsDirPath = path.join(dbDirPath, 'migrations');
      const schemaFilePath = path.join(typebaseDirPath, 'db', 'schema.ts');
      const relationsFilePath = path.join(typebaseDirPath, 'db', 'relations.ts');
      const actionsDirPath = path.join(typebaseDirPath, 'actions');

      const generatedDirPath = path.join(typebaseDirPath, '_generated');
      const dbTypesOutputPath = path.join(generatedDirPath, 'db.d.ts');

      if (!hasAuth(authFilePath)) {
        throw new Error('No auth config found. Create an auth file at auth.ts first.');
      }

      resolveProjectShapeOrThrow({ schemaFilePath, authFilePath, envFilePath, publisherFilePath });

      const authSpinner = ora('Generating auth tables...').start();

      await getAndSaveAuthSecret();
      await generateAuthSchema({ schemaFilePath, relationsFilePath, authFilePath });

      authSpinner.succeed('Auth tables added to schema.ts and relations.ts.');

      if (hasMigrations(migrationsDirPath)) {
        const migration = await generateMigration({ dbDirPath, migrationsDirPath, serverProvider, name: 'auth tables' });

        if (migration) {
          ora().succeed(`Migration written to ${path.relative(process.cwd(), migration.dirPath)}.`);
        }
      }

      const typesSpinner = ora('Generating types...').start();

      await Promise.all([
        generateDBTypes({ schemaFilePath, authFilePath, outFilePath: dbTypesOutputPath }),
        generateServerTypes({ tsConfigFilePath, schemaFilePath, authFilePath, envFilePath, publisherFilePath, actionsDirPath, generatedDirPath }),
      ]);

      typesSpinner.succeed('Types generated!');
    })
);
