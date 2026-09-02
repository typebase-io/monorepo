import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { pushSchema as drizzlePush } from 'drizzle-kit/api-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import ora from 'ora';

import { type RunPrompt } from '#helpers/shared/run-until-stopped.ts';

export const pushSchema = async ({
  serverDistDirPath,
  connectionUri,
  skipConfirmation,
  dryRun,
  prompt = (ask) => ask(),
}: {
  serverDistDirPath: string;
  connectionUri: string;
  skipConfirmation: boolean;
  dryRun?: boolean;
  prompt?: RunPrompt;
}) => {
  const schemaPath = path.join(serverDistDirPath, 'src', 'db', 'schema.js');
  const symlinkPath = path.join(serverDistDirPath, 'node_modules');

  const symlinkExists = await fs.access(symlinkPath).then(
    () => true,
    () => false
  );

  if (!symlinkExists) {
    await fs.symlink(path.resolve('node_modules'), symlinkPath);
  }

  try {
    const schema = (await import(pathToFileURL(schemaPath).href)) as Record<string, unknown>;
    const db = drizzle(connectionUri);

    db.$client.on('error', () => {
      // Do nothing
    });

    try {
      const spinner = ora('Analyzing schema changes...').start();
      const { sqlStatements, hints, apply } = await drizzlePush(schema, db, 'snake_case');

      if (dryRun) {
        spinner.stop();

        return { sqlStatements };
      }

      if (sqlStatements.length === 0) {
        spinner.succeed('Schema is up to date.');

        return { sqlStatements };
      }

      spinner.stop();

      if (hints.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));

        for (const hint of hints) {
          console.log(chalk.yellow(hint.hint));
        }

        console.log('\n');

        if (!skipConfirmation) {
          const accepted = await prompt(() => confirm({ message: 'Apply these changes?' }));

          if (!accepted) {
            throw new Error('Schema push cancelled. Deploy aborted.');
          }
        }
      }

      const applySpinner = ora('Pushing schema...').start();

      await apply();

      applySpinner.succeed('Schema pushed to database.');

      return { sqlStatements };
    } finally {
      await db.$client.end();
    }
  } finally {
    if (!symlinkExists) {
      await fs.unlink(symlinkPath);
    }
  }
};
