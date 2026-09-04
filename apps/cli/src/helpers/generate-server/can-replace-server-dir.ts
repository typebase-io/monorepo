import fs from 'node:fs/promises';
import path from 'node:path';

import { SERVER_MARKER_FILE_NAME, serverMarkerSchema } from '#helpers/constants.ts';
import { safeReadJsonFile } from '#helpers/shared/safe-read-json-file.ts';

export const canReplaceServerDir = async (dirPath: string) => {
  const stats = await fs.stat(dirPath).catch(() => null);

  if (!stats) {
    return true;
  }

  if (!stats.isDirectory()) {
    return false;
  }

  const entries = await fs.readdir(dirPath);

  if (entries.length === 0) {
    return true;
  }

  const marker = await safeReadJsonFile(path.join(dirPath, SERVER_MARKER_FILE_NAME));

  if (serverMarkerSchema.safeParse(marker).success) {
    return true;
  }

  const packageJson = await safeReadJsonFile(path.join(dirPath, 'package.json'));

  return (packageJson as { name?: string } | null)?.name === '@typebase-io/server';
};
