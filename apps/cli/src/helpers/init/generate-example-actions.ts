import fs from 'node:fs/promises';
import path from 'node:path';

import { exampleCustomActionsTemplate } from '#helpers/templates/example-custom-actions-template.ts';
import { exampleMutationActionTemplate } from '#helpers/templates/example-mutation-action.ts';
import { exampleQueryActionTemplate } from '#helpers/templates/example-query-action.ts';

export const generateExampleActions = async ({ typebaseDirPath, withAuth }: { typebaseDirPath: string; withAuth: boolean }) => {
  const queriesDirPath = path.join(typebaseDirPath, 'actions', 'queries');
  const mutationsDirPath = path.join(typebaseDirPath, 'actions', 'mutations');

  const customActionsPath = path.join(typebaseDirPath, 'actions', 'custom-actions.ts');
  const todosQueriesPath = path.join(queriesDirPath, 'todos.ts');
  const todosMutationsPath = path.join(mutationsDirPath, 'todos.ts');

  await fs.mkdir(queriesDirPath, { recursive: true });
  await fs.mkdir(mutationsDirPath, { recursive: true });

  await fs.writeFile(todosQueriesPath, `${exampleQueryActionTemplate(withAuth)}\n`);
  await fs.writeFile(todosMutationsPath, `${exampleMutationActionTemplate(withAuth)}\n`);

  if (withAuth) {
    await fs.writeFile(customActionsPath, `${exampleCustomActionsTemplate}\n`);
  }
};
