import { existsSync } from 'node:fs';
import path from 'node:path';

export const hasPublisher = (publisherFilePath: string) => {
  return existsSync(path.resolve(publisherFilePath));
};
