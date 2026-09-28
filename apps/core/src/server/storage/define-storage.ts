import {
  type StorageProvider,
  type StorageProviderBucket,
  type StorageProviderBucketOptions,
  type StorageProviderOptions,
} from '#server/storage/providers/index.ts';

export type StorageBuckets<TProvider extends StorageProvider> = Record<string, StorageProviderBucketOptions[TProvider]>;

export interface StorageConfig<
  TProvider extends StorageProvider = StorageProvider,
  TBuckets extends StorageBuckets<TProvider> = StorageBuckets<TProvider>,
> {
  provider: TProvider;
  options?: StorageProviderOptions[TProvider];
  buckets: TBuckets;
}

export type StorageInstance<TConfig> = TConfig extends { provider: infer TProvider extends StorageProvider; buckets: infer TBuckets }
  ? { bucket: <TBucketName extends keyof TBuckets & string>(name: TBucketName) => StorageProviderBucket<TProvider, TBuckets[TBucketName]> }
  : never;

export const defineStorage = <TProvider extends StorageProvider, const TBuckets extends StorageBuckets<TProvider>>(
  config: StorageConfig<TProvider, TBuckets>
): StorageConfig<TProvider, TBuckets> => {
  return config;
};
