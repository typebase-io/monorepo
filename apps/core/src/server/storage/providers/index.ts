import { type AccessBucket, type Bucket } from '#server/storage/bucket.ts';
import {
  type CloudflareBucketOptions,
  type CloudflareStorageOptions,
  type CloudflareStorageResources,
  createCloudflareBucket,
} from '#server/storage/providers/cloudflare.ts';
import {
  type FilesystemBucketOptions,
  type FilesystemStorageOptions,
  type FilesystemStorageResources,
  createFilesystemBucket,
} from '#server/storage/providers/filesystem.ts';
import {
  type VercelBucketOptions,
  type VercelStorageOptions,
  type VercelStorageResources,
  createVercelBucket,
} from '#server/storage/providers/vercel.ts';

export interface StorageProviderOptions {
  vercel: VercelStorageOptions;
  cloudflare: CloudflareStorageOptions;
  filesystem: FilesystemStorageOptions;
}

export interface StorageProviderBucketOptions {
  vercel: VercelBucketOptions;
  cloudflare: CloudflareBucketOptions;
  filesystem: FilesystemBucketOptions;
}

export interface StorageProviderResources {
  vercel: VercelStorageResources;
  cloudflare: CloudflareStorageResources;
  filesystem: FilesystemStorageResources;
}

export type StorageProvider = keyof StorageProviderOptions;

export type StorageProviderBucket<TProvider extends StorageProvider, TBucketOptions> = TProvider extends 'filesystem'
  ? Bucket
  : AccessBucket<TBucketOptions>;

export type StorageBucketFactory<TProvider extends StorageProvider> = (args: {
  name: string;
  bucket: StorageProviderBucketOptions[TProvider];
  options: StorageProviderOptions[TProvider] | undefined;
  resources: StorageProviderResources[TProvider];
}) => Bucket;

export const storageBucketFactories: { [TProvider in StorageProvider]: StorageBucketFactory<TProvider> } = {
  vercel: createVercelBucket,
  cloudflare: createCloudflareBucket,
  filesystem: createFilesystemBucket,
};
