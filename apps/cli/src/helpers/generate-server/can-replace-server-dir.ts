import fs from 'node:fs/promises';
import path from 'node:path';

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

  const packageJsonContent = await fs.readFile(path.join(dirPath, 'package.json'), 'utf-8').catch(() => null);

  if (packageJsonContent === null) {
    return false;
  }

  try {
    return (JSON.parse(packageJsonContent) as { name?: string }).name === '@typebase-io/server';
  } catch {
    return false;
  }
};
