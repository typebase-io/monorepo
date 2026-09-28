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

export const storageFileTemplate = ({
  config,
  imports,
  provider,
  localStorage,
  publicBuckets = [],
  ts,
}: {
  config: string;
  imports: string[];
  provider: StorageProvider;
  localStorage?: Pick<LocalStorageRoute, 'root' | 'url'>;
  publicBuckets?: string[];
  ts: boolean;
}) => {
  if (provider === 'filesystem') {
    return ['import { createStorage } from "typebase-io/server";', ...imports, '', `export const storage = createStorage(${config}, {});`].join('\n');
  }

  if (localStorage === undefined) {
    const resources =
      provider === 'vercel'
        ? `{ tokens: env.${VERCEL_STORAGE_TOKENS_ENV_KEY} }`
        : [
            '{',
            `  accountId: env.${R2_ACCOUNT_ID_ENV_KEY},`,
            `  accessKeyId: env.${R2_ACCESS_KEY_ID_ENV_KEY},`,
            `  secretAccessKey: env.${R2_SECRET_ACCESS_KEY_ENV_KEY},`,
            `  buckets: env.${R2_BUCKETS_ENV_KEY},`,
            '  publicUrls: {',
            ...publicBuckets.map((bucket) => `    ${JSON.stringify(bucket)}: env.${getR2PublicUrlEnvKey(bucket)},`),
            '  },',
            '}',
          ].join('\n');

    return [
      'import { createStorage } from "typebase-io/server";',
      `import { env } from "${ts ? './env.ts' : './env.js'}";`,
      ...imports,
      '',
      `export const storage = createStorage(${config}, ${resources});`,
    ].join('\n');
  }

  return [
    'import { createStorage } from "typebase-io/server";',
    'import { createLocalStorage } from "typebase-io/server/local-storage";',
    ...imports,
    '',
    `export const localFileStorage = createLocalStorage({ root: ${JSON.stringify(localStorage.root)}, url: ${JSON.stringify(localStorage.url)} });`,
    '',
    `export const storage = createStorage(${config}, { local: localFileStorage });`,
  ].join('\n');
};
