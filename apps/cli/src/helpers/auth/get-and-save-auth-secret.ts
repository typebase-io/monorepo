import crypto from 'node:crypto';

import { readEnvVariable } from '#helpers/shared/read-env-variable.ts';
import { writeEnvFile } from '#helpers/shared/write-env-file.ts';

export const getAndSaveAuthSecret = async () => {
  let secret = readEnvVariable('BETTER_AUTH_SECRET');

  if (!secret) {
    secret = crypto.randomBytes(32).toString('base64');
    await writeEnvFile('BETTER_AUTH_SECRET', secret);
  }

  return secret;
};
