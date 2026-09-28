import { type Adapter, Files } from 'files-sdk';
import { vercelBlob } from 'files-sdk/vercel-blob';

import { type AccessBucketOptions, type Bucket, type BucketAccess } from '#server/storage/bucket.ts';
import { createFilesBucket } from '#server/storage/create-files-bucket.ts';
import { type LocalStorage } from '#server/storage/local-storage/create-local-storage.ts';
import { readVercelBucketToken } from '#server/storage/providers/read-vercel-bucket-token.ts';

export interface VercelStorageOptions {
  region?: string;
}

export type VercelBucketOptions = AccessBucketOptions;

export type VercelStorageResources =
  | {
      local: LocalStorage;
    }
  | {
      tokens: string | undefined;
      adapter?: (args: { token: string; access: BucketAccess }) => Adapter;
    };

export const createVercelBucket = ({
  name,
  bucket,
  resources,
}: {
  name: string;
  bucket: VercelBucketOptions;
  resources: VercelStorageResources;
}): Bucket => {
  if ('local' in resources) {
    return resources.local.createBucket({ name, bucket });
  }

  const token = readVercelBucketToken(resources.tokens, name);
  const { access } = bucket;
  const adapter = resources.adapter?.({ token, access }) ?? vercelBlob({ token, access });

  return createFilesBucket({ files: new Files({ adapter, prefix: bucket.prefix, plugins: bucket.plugins, hooks: bucket.hooks }), access });
};
