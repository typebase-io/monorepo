import fs from 'node:fs/promises';

import { fixImportExtensions } from '#helpers/shared/fix-import-extensions.ts';

export const generateActionsFiles = async ({
  actionsDirPath,
  actionsOutputDirPath,
  useTs,
}: {
  actionsDirPath: string;
  actionsOutputDirPath: string;
  useTs: boolean;
}) => {
  await fs.cp(actionsDirPath, actionsOutputDirPath, { recursive: true });
  await fixImportExtensions(actionsOutputDirPath, useTs ? 'ts' : 'js');
};
