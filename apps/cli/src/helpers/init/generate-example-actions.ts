import fs from 'node:fs/promises';
import path from 'node:path';

import { exampleCustomActionsTemplate } from '#helpers/templates/example-custom-actions-template.ts';
import { exampleMutationActionTemplate } from '#helpers/templates/example-mutation-action.ts';
import { exampleQueryActionTemplate } from '#helpers/templates/example-query-action.ts';
import { exampleStorageActionsTemplate } from '#helpers/templates/example-storage-actions.ts';

export const generateExampleActions = async ({
  typebaseDirPath,
  withAuth,
  withPublisher,
  withStorage,
}: {
  typebaseDirPath: string;
  withAuth: boolean;
  withPublisher: boolean;
  withStorage: boolean;
}) => {
  const queriesDirPath = path.join(typebaseDirPath, 'actions', 'queries');
  const mutationsDirPath = path.join(typebaseDirPath, 'actions', 'mutations');

  const customActionsPath = path.join(typebaseDirPath, 'actions', 'custom-actions.ts');
  const todosQueriesPath = path.join(queriesDirPath, 'todos.ts');
  const todosMutationsPath = path.join(mutationsDirPath, 'todos.ts');
  const storageQueriesPath = path.join(queriesDirPath, 'storage.ts');

  await fs.mkdir(queriesDirPath, { recursive: true });
  await fs.mkdir(mutationsDirPath, { recursive: true });

  await fs.writeFile(todosQueriesPath, `${exampleQueryActionTemplate(withAuth, withPublisher)}\n`);
  await fs.writeFile(todosMutationsPath, `${exampleMutationActionTemplate(withAuth, withPublisher)}\n`);

  if (withAuth) {
    await fs.writeFile(customActionsPath, `${exampleCustomActionsTemplate}\n`);
  }

  if (withStorage) {
    await fs.writeFile(storageQueriesPath, `${exampleStorageActionsTemplate}\n`);
  }
};
