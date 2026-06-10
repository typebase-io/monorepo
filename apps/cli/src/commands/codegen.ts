import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import ora from 'ora';

import { generateDBTypes } from '#helpers/shared/generate-db-types.ts';
import { generateServerTypes } from '#helpers/shared/generate-server-types.ts';
import { getTypebaseConfig } from '#helpers/shared/get-typebase-config.ts';
import { validateTypes } from '#helpers/shared/validate-types.ts';

export const codegen = new Command('codegen')
  .summary('Generate backend type definitions')
  .description('Generate files in `<typebase>/_generated/` from `<typebase>/db/schema.ts` and `<typebase>/actions`.')
  .allowExcessArguments(false)
  .action(async () => {
    const config = await getTypebaseConfig();
    const typebaseDirPath = path.resolve(config.projectPath);

    const tsConfigFilePath = path.join(typebaseDirPath, 'tsconfig.json');
    const schemaFilePath = path.join(typebaseDirPath, 'db', 'schema.ts');
    const authFilePath = path.join(typebaseDirPath, 'auth.ts');
    const actionsDirPath = path.join(typebaseDirPath, 'actions');
    const generatedDirPath = path.join(typebaseDirPath, '_generated');
    const dbTypesOutputPath = path.join(generatedDirPath, 'db.d.ts');

    validateTypes({
      dirPath: typebaseDirPath,
      tsConfigFilePath,
      skipErrors: true,
      quiet: false,
      excludeDirPaths: [path.resolve(typebaseDirPath, config.server.outDir)],
    });

    const spinner = ora('Generating types...').start();

    await Promise.all([
      generateDBTypes({ schemaFilePath, authFilePath, outFilePath: dbTypesOutputPath }),
      generateServerTypes({ tsConfigFilePath, schemaFilePath, authFilePath, actionsDirPath, generatedDirPath }),
    ]);

    spinner.succeed('Types generated!');
  });
