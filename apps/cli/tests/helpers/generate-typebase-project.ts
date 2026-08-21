import path from 'node:path';

import { generateExampleActions } from '#helpers/init/generate-example-actions.ts';
import { generateExampleAuth } from '#helpers/init/generate-example-auth.ts';
import { generateExamplePublisher } from '#helpers/init/generate-example-publisher.ts';
import { generateExampleRelations } from '#helpers/init/generate-example-relations.ts';
import { generateExampleSchema } from '#helpers/init/generate-example-schema.ts';
import { generateTsConfig } from '#helpers/shared/generate-ts-config.ts';

import { type TempDir } from '#tests/helpers/temp-dir.ts';

export const generateTypebaseProject = async (
  tmp: TempDir,
  { withAuth = true, withPublisher = false }: { withAuth?: boolean; withPublisher?: boolean } = {}
): Promise<string> => {
  const projectDir = path.join(tmp.path, 'typebase');

  tmp.mkdir('typebase/db');
  tmp.write('typebase/package.json', JSON.stringify({ name: 'app', dependencies: { 'typebase-io': '0.1.0' } }));

  await generateTsConfig({ path: path.join(projectDir, 'tsconfig.json'), addWarning: false });
  await generateExampleSchema({ path: path.join(projectDir, 'db', 'schema.ts'), withAuth, withPublisher });
  await generateExampleRelations({ path: path.join(projectDir, 'db', 'relations.ts'), withAuth, withPublisher });
  await generateExampleActions({ typebaseDirPath: projectDir, withAuth, withPublisher });

  if (withAuth) {
    await generateExampleAuth(path.join(projectDir, 'auth.ts'));
  }

  if (withPublisher) {
    await generateExamplePublisher(path.join(projectDir, 'publisher.ts'));
  }

  return projectDir;
};
