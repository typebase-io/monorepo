import { type BucketAccess } from '#helpers/constants.ts';

export interface StorageProviderClient {
  listBuckets: () => Promise<{ name: string; access: BucketAccess }[]>;
  createBucket: (bucket: { name: string; access: BucketAccess }) => Promise<void>;
  getCredentials: (
    buckets: { bucket: string; name: string; access: BucketAccess }[],
    stored: (key: string) => string | undefined
  ) => Promise<{ key: string; value: string }[]>;
}
