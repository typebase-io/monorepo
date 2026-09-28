import { type Bucket } from '#server/storage/bucket.ts';
import { type StorageConfig, type StorageInstance } from '#server/storage/define-storage.ts';
import { type StorageProviderResources, storageBucketFactories } from '#server/storage/providers/index.ts';
import { validateBucketName } from '#server/storage/validate-bucket-name.ts';

export const createStorage = <TConfig extends StorageConfig>(
  config: TConfig,
  resources: StorageProviderResources[TConfig['provider']]
): StorageInstance<TConfig> => {
  const { provider, options, buckets: declaredBuckets } = config as StorageConfig<TConfig['provider']>;
  const createBucket = storageBucketFactories[provider];
  const buckets = new Map<string, Bucket>();

  for (const [name, bucket] of Object.entries(declaredBuckets)) {
    validateBucketName(name);
    buckets.set(name, createBucket({ name, bucket, options, resources }));
  }

  const storage = {
    bucket: (name: string) => {
      const bucket = buckets.get(name);

      if (!bucket) {
        throw new Error(`Storage has no bucket named \`${name}\`. Declare it in \`storage.ts\`.`);
      }

      return bucket;
    },
  };

  return storage as unknown as StorageInstance<TConfig>;
};
