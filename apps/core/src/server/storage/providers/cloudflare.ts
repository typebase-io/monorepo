import { type Adapter, Files } from 'files-sdk';
import { type R2HttpOptions, r2 } from 'files-sdk/r2';

import { type AccessBucketOptions, type Bucket } from '#server/storage/bucket.ts';
import { createFilesBucket } from '#server/storage/create-files-bucket.ts';
import { type LocalStorage } from '#server/storage/local-storage/create-local-storage.ts';
import { type R2Keys, readR2BucketKeys } from '#server/storage/providers/read-r2-bucket-keys.ts';

export type R2LocationHint = 'wnam' | 'enam' | 'weur' | 'eeur' | 'apac' | 'oc';

export interface CloudflareStorageOptions {
  locationHint?: R2LocationHint;
}

export type CloudflareBucketOptions = AccessBucketOptions;

export type CloudflareStorageResources =
  | {
      local: LocalStorage;
    }
  | (R2Keys & {
      adapter?: (options: R2HttpOptions) => Adapter;
    });

export const createCloudflareBucket = ({
  name,
  bucket,
  resources,
}: {
  name: string;
  bucket: CloudflareBucketOptions;
  resources: CloudflareStorageResources;
}): Bucket => {
  if ('local' in resources) {
    return resources.local.createBucket({ name, bucket });
  }

  const { access } = bucket;
  const options: R2HttpOptions = { ...readR2BucketKeys(resources, name, access), client: 'fetch' };
  const adapter = resources.adapter?.(options) ?? r2(options);

  return createFilesBucket({ files: new Files({ adapter, prefix: bucket.prefix, plugins: bucket.plugins, hooks: bucket.hooks }), access });
};
