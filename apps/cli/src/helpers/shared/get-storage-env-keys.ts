import {
  type LocalStorageRoute,
  R2_ACCESS_KEY_ID_ENV_KEY,
  R2_ACCOUNT_ID_ENV_KEY,
  R2_BUCKETS_ENV_KEY,
  R2_SECRET_ACCESS_KEY_ENV_KEY,
  type StorageProvider,
  VERCEL_STORAGE_TOKENS_ENV_KEY,
} from '#helpers/constants.ts';
import { getR2PublicUrlEnvKey } from '#helpers/shared/get-r2-public-url-env-key.ts';
import { getDeclaredStorage } from '#helpers/storage/get-declared-storage.ts';

export const getStorageEnvKeys = ({
  provider,
  localStorage,
  storageFilePath,
}: {
  provider: false | StorageProvider;
  localStorage: Pick<LocalStorageRoute, 'root' | 'url'> | undefined;
  storageFilePath: string;
}): string[] => {
  if (localStorage !== undefined) {
    return [];
  }

  if (provider === 'vercel') {
    return [VERCEL_STORAGE_TOKENS_ENV_KEY];
  }

  if (provider === 'cloudflare') {
    const publicUrlKeys = getDeclaredStorage(storageFilePath)
      .buckets.filter(({ access }) => access === 'public')
      .map(({ bucket }) => getR2PublicUrlEnvKey(bucket));

    return [R2_ACCOUNT_ID_ENV_KEY, R2_ACCESS_KEY_ID_ENV_KEY, R2_SECRET_ACCESS_KEY_ENV_KEY, R2_BUCKETS_ENV_KEY, ...publicUrlKeys];
  }

  return [];
};
