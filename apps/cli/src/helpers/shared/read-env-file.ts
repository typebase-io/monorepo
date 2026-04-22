import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as dotenv from 'dotenv';

export const readEnvFile = (): Record<string, string> => {
  const envPath = path.resolve('.env');

  if (!existsSync(envPath)) {
    return {};
  }

  return dotenv.parse(readFileSync(envPath));
};
