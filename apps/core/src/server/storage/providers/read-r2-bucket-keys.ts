import { type BucketAccess } from '#server/storage/bucket.ts';
import { parseBucketMap } from '#server/storage/providers/parse-bucket-map.ts';

const R2_ACCOUNT_ID_ENV_KEY = 'TYPEBASE_STORAGE_R2_ACCOUNT_ID';
const R2_ACCESS_KEY_ID_ENV_KEY = 'TYPEBASE_STORAGE_R2_ACCESS_KEY_ID';
const R2_SECRET_ACCESS_KEY_ENV_KEY = 'TYPEBASE_STORAGE_R2_SECRET_ACCESS_KEY';
const R2_BUCKETS_ENV_KEY = 'TYPEBASE_STORAGE_R2_BUCKETS';
const R2_PUBLIC_URL_ENV_KEY_PREFIX = 'TYPEBASE_STORAGE_R2_PUBLIC_URL_';
const STORAGE_SYNC_COMMAND = 'npx typebase-io-cli storage sync <target>';

export interface R2Keys {
  accountId: string | undefined;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  buckets: string | undefined;
  publicUrls?: Record<string, string | undefined>;
}

export const readR2BucketKeys = (
  keys: R2Keys,
  bucketName: string,
  access: BucketAccess
): { bucket: string; accountId: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl?: string } => {
  const required = (value: string | undefined, envKey: string) => {
    if (value === undefined || value === '') {
      throw new Error(`${envKey} is not set. Run \`${STORAGE_SYNC_COMMAND}\` to create the buckets and write their keys.`);
    }

    return value;
  };

  const accountId = required(keys.accountId, R2_ACCOUNT_ID_ENV_KEY);
  const accessKeyId = required(keys.accessKeyId, R2_ACCESS_KEY_ID_ENV_KEY);
  const secretAccessKey = required(keys.secretAccessKey, R2_SECRET_ACCESS_KEY_ENV_KEY);
  const buckets = parseBucketMap(required(keys.buckets, R2_BUCKETS_ENV_KEY));

  if (!buckets) {
    throw new Error(`${R2_BUCKETS_ENV_KEY} must be a JSON object from bucket name to R2 bucket name.`);
  }

  const bucket = buckets[bucketName];

  if (!bucket) {
    throw new Error(
      `${R2_BUCKETS_ENV_KEY} has no R2 bucket for the bucket \`${bucketName}\`. Run \`${STORAGE_SYNC_COMMAND}\` to create the bucket and write its keys.`
    );
  }

  if (access === 'private') {
    return { bucket, accountId, accessKeyId, secretAccessKey };
  }

  const publicBaseUrl = keys.publicUrls?.[bucketName];

  if (!publicBaseUrl) {
    throw new Error(
      `${R2_PUBLIC_URL_ENV_KEY_PREFIX}${bucketName.toUpperCase().replaceAll('-', '_')} is not set, and the public bucket \`${bucketName}\` needs it for its URLs. Run \`${STORAGE_SYNC_COMMAND}\` to enable its r2.dev domain and write its keys.`
    );
  }

  return { bucket, accountId, accessKeyId, secretAccessKey, publicBaseUrl };
};
