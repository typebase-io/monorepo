import { readEnvFile } from '#helpers/shared/read-env-file.ts';

export const readEnvVariable = (name: string): string | undefined => {
  if (process.env[name]) {
    return process.env[name];
  }

  return readEnvFile()[name];
};
