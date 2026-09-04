import fs from 'node:fs/promises';

export const safeReadJsonFile = async (filePath: string) => {
  const contents = await fs.readFile(filePath, 'utf8').catch(() => null);

  if (contents === null) {
    return null;
  }

  try {
    return JSON.parse(contents) as unknown;
  } catch {
    return null;
  }
};
