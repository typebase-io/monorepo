import { parseBucketMap } from '#server/storage/providers/parse-bucket-map.ts';

const VERCEL_STORAGE_TOKENS_ENV_KEY = 'TYPEBASE_STORAGE_VERCEL_TOKENS';

export const readVercelBucketToken = (tokens: string | undefined, bucketName: string) => {
  if (tokens === undefined || tokens === '') {
    throw new Error(
      `${VERCEL_STORAGE_TOKENS_ENV_KEY} is not set. Run \`npx typebase-io-cli storage sync <target>\` to create the buckets and write their tokens.`
    );
  }

  const parsed = parseBucketMap(tokens);

  if (!parsed) {
    throw new Error(`${VERCEL_STORAGE_TOKENS_ENV_KEY} must be a JSON object from bucket name to Blob store token.`);
  }

  const token = parsed[bucketName];

  if (!token) {
    throw new Error(
      `${VERCEL_STORAGE_TOKENS_ENV_KEY} has no token for the bucket \`${bucketName}\`. Run \`npx typebase-io-cli storage sync <target>\` to create the bucket and write its token.`
    );
  }

  return token;
};
