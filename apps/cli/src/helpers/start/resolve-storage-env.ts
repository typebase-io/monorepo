import ora from 'ora';

import { type EnvTarget, VERCEL_STORAGE_TOKENS_ENV_KEY } from '#helpers/constants.ts';
import { getStorageEnvKeys } from '#helpers/shared/get-storage-env-keys.ts';
import { getStorageProvider } from '#helpers/shared/get-storage-provider.ts';
import { readEnvFile } from '#helpers/shared/read-env-file.ts';

export const resolveStorageEnv = ({
  devStorage,
  prodStorage,
  storageFilePath,
}: {
  devStorage: boolean | undefined;
  prodStorage: boolean | undefined;
  storageFilePath: string;
}):
  | {
      target: EnvTarget;
      source: string;
      env: { key: string; value: string }[];
    }
  | undefined => {
  const target: EnvTarget | undefined = devStorage ? 'dev' : prodStorage ? 'prod' : undefined;
  const provider = target === undefined ? undefined : getStorageProvider(storageFilePath);

  if (target === undefined || provider === undefined) {
    return undefined;
  }

  if (provider === 'filesystem') {
    ora().warn(`\`--${target}-storage\` has no effect: \`storage.ts\` declares the \`filesystem\` provider, which keeps its files where it says.`);

    return undefined;
  }

  const toEnvKey = (key: string) => (target === 'dev' ? `${key}_DEV` : key);
  const projectEnv = readEnvFile();

  const env = getStorageEnvKeys({ provider, localStorage: undefined, storageFilePath }).map((key) => {
    const value = projectEnv[toEnvKey(key)];

    if (!value) {
      throw new Error(
        `No storage keys found in ${toEnvKey(key)}. Run \`npx typebase-io-cli storage sync ${target}\` to create the ${target} buckets and write their keys to .env.`
      );
    }

    return { key, value };
  });

  const source = provider === 'vercel' ? toEnvKey(VERCEL_STORAGE_TOKENS_ENV_KEY) : toEnvKey('TYPEBASE_STORAGE_R2_*');

  return { target, source, env };
};
