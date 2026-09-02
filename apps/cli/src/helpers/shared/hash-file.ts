import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

export const hashFile = async (filePath: string): Promise<string> => {
  try {
    return createHash('sha256')
      .update(await fs.readFile(filePath))
      .digest('hex');
  } catch {
    return '';
  }
};
